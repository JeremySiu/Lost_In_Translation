/**
 * Genius lyrics fetcher using native fetch + node-html-parser.
 * Replaces genius-lyrics package to avoid its undici v7 incompatibility on Vercel.
 */
import { parse } from 'node-html-parser'

const GENIUS_API = 'https://api.genius.com'
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36'
const BROWSER_HEADERS = {
  'User-Agent': DEFAULT_UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
}

/**
 * Searches Genius for a song and returns the URL of the first match, or null.
 * Uses the official API when a token is provided; falls back to the unofficial
 * search endpoint otherwise.
 */
export async function searchGeniusSong(query, token) {
  try {
    if (token) {
      const res = await fetch(
        `${GENIUS_API}/search?q=${encodeURIComponent(sanitizeQuery(query))}`,
        { headers: { Authorization: `Bearer ${token}` } }
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
  } catch {
    return null
  }
}

/**
 * Fetches and parses lyrics from a Genius song page URL.
 * Returns the raw lyrics string, or null if unavailable.
 */
export async function fetchGeniusLyrics(url) {
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS })
    if (!res.ok) {
      console.warn(`[genius] lyrics page returned ${res.status} for ${url}`)
      return null
    }
    const html = await res.text()

    const doc = parse(html)
    const containers = doc.querySelectorAll('[data-lyrics-container="true"]')
    if (!containers.length) return null

    // Serialize each container to HTML, replace <br> tags with newlines, then
    // strip remaining tags — this preserves line breaks that .text alone drops.
    const lyrics = containers
      .map(el => el.innerHTML
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .trim()
      )
      .join('\n')
      .trim()

    return lyrics.length ? lyrics : null
  } catch {
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

function sanitizeQuery(query) {
  return query
    .toLowerCase()
    .replace(/ *\([^)]*\) */g, '')
    .replace(/ *\[[^\]]*]/g, '')
    .replace(/feat\.|ft\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
