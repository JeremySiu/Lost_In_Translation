/**
 * Genius lyrics fetcher using only native fetch — no third-party parser.
 * Replaces genius-lyrics/node-html-parser to avoid ESM/undici issues on Vercel.
 */

const GENIUS_API = 'https://api.genius.com'
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36'
const BROWSER_HEADERS = {
  'User-Agent': DEFAULT_UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
}

/**
 * Searches Genius for a song and returns the URL of the first match, or null.
 */
export async function searchGeniusSong(query, token) {
  try {
    if (token) {
      const res = await fetch(
        `${GENIUS_API}/search?q=${encodeURIComponent(sanitizeQuery(query))}`,
        { headers: { Authorization: `Bearer ${token}`, 'User-Agent': DEFAULT_UA } }
      )
      if (!res.ok) {
        console.warn(`[genius] search API returned ${res.status} for "${query}"`)
        return null
      }
      const data = await res.json()
      const song = (data?.response?.hits ?? []).find(h => h.type === 'song')
      return song?.result?.url ?? null
    }

    // Keyless fallback — unofficial endpoint
    const res = await fetch(
      `https://genius.com/api/search/song?per_page=5&q=${encodeURIComponent(sanitizeQuery(query))}`,
      { headers: BROWSER_HEADERS }
    )
    if (!res.ok) {
      console.warn(`[genius] unofficial search returned ${res.status} for "${query}"`)
      return null
    }
    const data = await res.json()
    const hits = (data?.response?.sections ?? []).flatMap(s => s.hits ?? [])
    const song = hits.find(h => h.type === 'song')
    return song?.result?.url ?? null
  } catch (err) {
    console.warn(`[genius] search threw for "${query}":`, err?.message)
    return null
  }
}

/**
 * Fetches and parses lyrics from a Genius song page URL using pure string ops.
 * Walks the HTML to find data-lyrics-container divs without any parser library.
 */
export async function fetchGeniusLyrics(url) {
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS })
    if (!res.ok) {
      console.warn(`[genius] lyrics page returned ${res.status} for ${url}`)
      return null
    }
    const html = await res.text()
    const containers = extractDivsByAttr(html, 'data-lyrics-container', 'true')
    if (!containers.length) {
      console.warn(`[genius] no lyrics containers found at ${url}`)
      return null
    }

    const lyrics = containers
      .map(inner => inner
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#x27;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
        .trim()
      )
      .join('\n')
      .trim()

    return lyrics.length ? lyrics : null
  } catch (err) {
    console.warn(`[genius] lyrics fetch threw for ${url}:`, err?.message)
    return null
  }
}

/**
 * Convenience: search then fetch lyrics. Returns null if either step fails.
 */
export async function getGeniusLyrics(title, artist, token) {
  const url = await searchGeniusSong(`${title} ${artist}`, token)
  if (!url) {
    console.warn(`[genius] no search result for "${title}" by "${artist}"`)
    return null
  }
  const lyrics = await fetchGeniusLyrics(url)
  if (!lyrics) console.warn(`[genius] no lyrics parsed from ${url}`)
  return lyrics
}

// ── HTML helpers ─────────────────────────────────────────────────────────────

/**
 * Extracts the innerHTML of every <div> whose attributes include attr="value".
 * Uses a depth-counting walk rather than a regex to handle nested divs correctly.
 */
function extractDivsByAttr(html, attr, value) {
  const results = []
  const marker = `${attr}="${value}"`
  let pos = 0

  while (pos < html.length) {
    const markerIdx = html.indexOf(marker, pos)
    if (markerIdx === -1) break

    // Walk back to the opening < of this tag
    const tagOpen = html.lastIndexOf('<', markerIdx)
    if (tagOpen === -1) { pos = markerIdx + marker.length; continue }

    // Find where the opening tag ends
    const tagClose = html.indexOf('>', markerIdx)
    if (tagClose === -1) { pos = markerIdx + marker.length; continue }

    // Self-closing tag — skip
    if (html[tagClose - 1] === '/') { pos = tagClose + 1; continue }

    // Walk forward counting <div depth to find the matching </div>
    let depth = 1
    let cursor = tagClose + 1
    while (depth > 0 && cursor < html.length) {
      const nextOpen = html.indexOf('<div', cursor)
      const nextClose = html.indexOf('</div>', cursor)

      if (nextClose === -1) break

      if (nextOpen !== -1 && nextOpen < nextClose) {
        // Another opening div before the next close — check it's a real tag
        const afterDiv = html[nextOpen + 4]
        if (afterDiv === '>' || afterDiv === ' ' || afterDiv === '\n' || afterDiv === '\r' || afterDiv === '\t' || afterDiv === '/') {
          depth++
        }
        cursor = nextOpen + 4
      } else {
        depth--
        if (depth === 0) {
          results.push(html.slice(tagClose + 1, nextClose))
        }
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
