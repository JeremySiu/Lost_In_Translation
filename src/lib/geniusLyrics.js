/**
 * Lyrics fetcher for server-side use on Vercel.
 *
 * Genius scraping is blocked from datacenter IPs (403 for all requests).
 * Instead we use lyrics.ovh — a free, keyless API that works from any IP
 * and returns full lyrics with section markers ([Chorus], [Verse], etc.)
 * that our extractChorus logic can parse.
 *
 * Genius official API is still used for the song search step (to validate
 * that a song exists and get metadata), but lyrics come from lyrics.ovh.
 */

const GENIUS_API = 'https://api.genius.com'
const LYRICS_OVH  = 'https://api.lyrics.ovh/v1'
const DEFAULT_UA  = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36'

/**
 * Fetches lyrics for a song. Returns raw lyrics string or null.
 * Tries lyrics.ovh first; falls back to Genius scraping (works locally,
 * blocked on Vercel but left in place for dev convenience).
 */
export async function getGeniusLyrics(title, artist, token) {
  // ── Primary: lyrics.ovh ────────────────────────────────────────────────────
  try {
    const url = `${LYRICS_OVH}/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
    const res = await fetch(url, { headers: { 'User-Agent': DEFAULT_UA } })
    if (res.ok) {
      const data = await res.json()
      if (data?.lyrics?.trim()) {
        return data.lyrics.trim()
      }
    } else {
      console.warn(`[lyrics] lyrics.ovh returned ${res.status} for "${title}" by "${artist}"`)
    }
  } catch (err) {
    console.warn(`[lyrics] lyrics.ovh threw for "${title}" by "${artist}":`, err?.message)
  }

  // ── Fallback: Genius scraping (dev only — blocked on Vercel) ───────────────
  try {
    const songUrl = await searchGeniusSong(`${title} ${artist}`, token)
    if (!songUrl) {
      console.warn(`[lyrics] no Genius result for "${title}" by "${artist}"`)
      return null
    }
    const lyrics = await scrapeGeniusLyrics(songUrl)
    if (!lyrics) console.warn(`[lyrics] Genius scrape returned nothing for ${songUrl}`)
    return lyrics
  } catch (err) {
    console.warn(`[lyrics] Genius fallback threw for "${title}" by "${artist}":`, err?.message)
    return null
  }
}

// ── Genius helpers (used only as fallback) ────────────────────────────────────

async function searchGeniusSong(query, token) {
  try {
    if (token) {
      const res = await fetch(
        `${GENIUS_API}/search?q=${encodeURIComponent(sanitizeQuery(query))}`,
        { headers: { Authorization: `Bearer ${token}`, 'User-Agent': DEFAULT_UA } }
      )
      if (!res.ok) return null
      const data = await res.json()
      const song = (data?.response?.hits ?? []).find(h => h.type === 'song')
      return song?.result?.url ?? null
    }
  } catch {
    return null
  }
  return null
}

async function scrapeGeniusLyrics(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': DEFAULT_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })
    if (!res.ok) return null
    const html = await res.text()
    const containers = extractDivsByAttr(html, 'data-lyrics-container', 'true')
    if (!containers.length) return null

    return containers
      .map(inner => inner
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#x27;/g, "'").replace(/&apos;/g, "'").replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
        .trim()
      )
      .join('\n')
      .trim() || null
  } catch {
    return null
  }
}

function extractDivsByAttr(html, attr, value) {
  const results = []
  const marker = `${attr}="${value}"`
  let pos = 0

  while (pos < html.length) {
    const markerIdx = html.indexOf(marker, pos)
    if (markerIdx === -1) break

    const tagOpen = html.lastIndexOf('<', markerIdx)
    if (tagOpen === -1) { pos = markerIdx + marker.length; continue }

    const tagClose = html.indexOf('>', markerIdx)
    if (tagClose === -1) { pos = markerIdx + marker.length; continue }

    if (html[tagClose - 1] === '/') { pos = tagClose + 1; continue }

    let depth = 1
    let cursor = tagClose + 1
    while (depth > 0 && cursor < html.length) {
      const nextOpen  = html.indexOf('<div', cursor)
      const nextClose = html.indexOf('</div>', cursor)
      if (nextClose === -1) break

      if (nextOpen !== -1 && nextOpen < nextClose) {
        const after = html[nextOpen + 4]
        if (after === '>' || after === ' ' || after === '\n' || after === '\r' || after === '\t' || after === '/') depth++
        cursor = nextOpen + 4
      } else {
        depth--
        if (depth === 0) results.push(html.slice(tagClose + 1, nextClose))
        cursor = nextClose + 6
      }
    }

    pos = tagClose + 1
  }

  return results
}

function sanitizeQuery(query) {
  return query
    .toLowerCase()
    .replace(/ *\([^)]*\) */g, '')
    .replace(/ *\[[^\]]*]/g, '')
    .replace(/feat\.|ft\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
