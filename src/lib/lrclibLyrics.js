/**
 * Lyrics fetcher using the LRCLIB public API (https://lrclib.net).
 *
 * LRCLIB is a free, open-source, keyless lyrics database with two formats:
 *   - syncedLyrics: LRC-format with per-line timestamps ("[MM:SS.xx] line")
 *   - plainLyrics:  plain text, no timestamps
 *
 * Strategy for hook-line extraction:
 *   1. Search by track_name + artist_name → pick best-matching result.
 *   2. If syncedLyrics is present, detect the chorus via repeated 4-line
 *      fingerprints (the chorus is the most repeated block in a song).
 *      Falls back to lines from the 25–50 % timestamp range if nothing repeats.
 *   3. If only plainLyrics is available, return the first 4 substantial lines.
 *
 * If lrclib has no entry for a track, this returns null so the caller can skip
 * that candidate and try the next one from the playlist pool.
 */

const LRCLIB_BASE = 'https://lrclib.net/api'
const USER_AGENT  = 'LostInTranslation/1.0 (https://github.com/yourusername/lost-in-translation)'

// ── Result selection ──────────────────────────────────────────────────────────

function norm(s) {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Score and pick the best lrclib result for the given title/artist.
 * Requires at least a title match; bonuses for artist match, synced lyrics,
 * and non-instrumental tracks.
 */
function pickBestResult(results, title, artist) {
  const tNorm = norm(title)
  const aNorm = norm(artist)

  const score = r => {
    const t = norm(r.trackName)
    const a = norm(r.artistName)
    const titleMatch = t.includes(tNorm) || tNorm.includes(t)
    const artistMatch = a.includes(aNorm) || aNorm.includes(a)
    if (!titleMatch) return -1
    return (artistMatch ? 2 : 0) +
           (r.syncedLyrics ? 1 : 0) +
           (!r.instrumental ? 1 : 0)
  }

  let best = null
  let bestScore = -1
  for (const r of results) {
    const s = score(r)
    if (s > bestScore) { bestScore = s; best = r }
  }

  return bestScore >= 0 ? best : null
}

// ── Synced lyrics parsing & chorus detection ──────────────────────────────────

/**
 * Parse LRC-format syncedLyrics into an array of { seconds, text } objects.
 */
function parseSyncedLyrics(syncedLyrics) {
  const lines = []
  for (const raw of syncedLyrics.split('\n')) {
    const m = raw.match(/^\[(\d{2}):(\d{2}(?:\.\d+)?)\]\s*(.*)$/)
    if (!m) continue
    const seconds = parseInt(m[1], 10) * 60 + parseFloat(m[2])
    const text = m[3].trim()
    if (text) lines.push({ seconds, text })
  }
  return lines
}

/**
 * Detect the chorus by finding the most-repeated 4-line window in the song.
 * Returns the raw text lines of the first occurrence, or null if no block
 * repeats at least twice.
 */
function detectChorusByRepetition(parsedLines) {
  const WINDOW = 4
  if (parsedLines.length < WINDOW * 2) return null

  const fingerprint = lines =>
    lines.map(l => l.text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()).join('|')

  const counts = new Map()
  const windows = []
  for (let i = 0; i <= parsedLines.length - WINDOW; i++) {
    const fp = fingerprint(parsedLines.slice(i, i + WINDOW))
    windows.push({ fp, i })
    counts.set(fp, (counts.get(fp) ?? 0) + 1)
  }

  let bestFp = null
  let bestCount = 1
  for (const [fp, count] of counts) {
    if (count > bestCount) { bestCount = count; bestFp = fp }
  }

  if (!bestFp) return null

  const first = windows.find(w => w.fp === bestFp)
  return parsedLines.slice(first.i, first.i + WINDOW).map(l => l.text)
}

/**
 * Extract hook lines from synced lyrics.
 * Priority: repeated-block chorus → lines from the 25–50 % timestamp zone.
 */
function extractHookFromSynced(syncedLyrics) {
  const lines = parseSyncedLyrics(syncedLyrics)
  if (!lines.length) return null

  const chorus = detectChorusByRepetition(lines)
  if (chorus) return chorus

  // Fallback: pick from the 25–50 % mark (typical chorus territory)
  if (lines.length < 4) return null
  const total = lines[lines.length - 1].seconds
  const startSec = total * 0.25
  const startIdx = lines.findIndex(l => l.seconds >= startSec)
  const from = startIdx === -1 ? Math.floor(lines.length * 0.25) : startIdx
  const slice = lines.slice(from).filter(l => l.text).slice(0, 4)
  return slice.length >= 4 ? slice.map(l => l.text) : null
}

/**
 * Extract hook lines from plain lyrics (no timestamps, no section markers).
 * Returns the first 4 lines that are at least 2 words long.
 */
function extractHookFromPlain(plainLyrics) {
  if (!plainLyrics) return null
  const lines = plainLyrics
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('[') && l.split(/\s+/).length >= 2)
  return lines.length >= 4 ? lines.slice(0, 4) : null
}

// ── Public API ────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms))

/**
 * Fetch and return 4 hook lines for a track from LRCLIB.
 *
 * Returns an array of 4 lyric line strings, or null if:
 *   - lrclib has no entry for this track
 *   - the entry is instrumental
 *   - not enough lines can be extracted
 *
 * Retries once on HTTP 429 (burst rate-limit) with a 1.5 s back-off before
 * giving up, so parallel calls from the playlist enrichment pipeline don't
 * all fail when they arrive at the server simultaneously.
 *
 * @param {string} title
 * @param {string} artist
 * @returns {Promise<string[]|null>}
 */
export async function getLrclibHookLines(title, artist) {
  const doSearch = async () => {
    const url =
      `${LRCLIB_BASE}/search` +
      `?track_name=${encodeURIComponent(title)}` +
      `&artist_name=${encodeURIComponent(artist)}`
    return fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  }

  try {
    let res = await doSearch()

    // Single retry on 429 after a short back-off
    if (res.status === 429) {
      console.warn(`[lrclib] 429 for "${title}" — retrying in 1s`)
      await sleep(1000)
      res = await doSearch()
    }

    if (!res.ok) {
      console.warn(`[lrclib] search HTTP ${res.status} for "${title}" by "${artist}"`)
      return null
    }

    const results = await res.json()
    if (!Array.isArray(results) || results.length === 0) {
      console.warn(`[lrclib] no results for "${title}" by "${artist}"`)
      return null
    }

    const best = pickBestResult(results, title, artist)
    if (!best) {
      console.warn(`[lrclib] no suitable match for "${title}" by "${artist}"`)
      return null
    }

    if (best.instrumental) {
      console.warn(`[lrclib] track is instrumental: "${title}" by "${artist}"`)
      return null
    }

    // Synced lyrics give us chorus detection via repetition
    if (best.syncedLyrics) {
      const lines = extractHookFromSynced(best.syncedLyrics)
      if (lines) return lines
    }

    // Plain lyrics fallback
    const lines = extractHookFromPlain(best.plainLyrics)
    if (!lines) {
      console.warn(`[lrclib] could not extract hook lines for "${title}" by "${artist}"`)
    }
    return lines
  } catch (err) {
    console.warn(`[lrclib] threw for "${title}" by "${artist}":`, err?.message)
    return null
  }
}
