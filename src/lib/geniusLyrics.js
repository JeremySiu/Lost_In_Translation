/**
 * Genius lyrics fetcher using native fetch + node-html-parser.
 * Replaces genius-lyrics package to avoid its undici v7 incompatibility on Vercel.
 */
import { parse } from 'node-html-parser'

const GENIUS_API = 'https://api.genius.com'
const DEFAULT_UA = 'Mozilla/5.0 (compatible; LostInTranslation/1.0)'

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
      if (!res.ok) return null
      const data = await res.json()
      const song = (data?.response?.hits ?? []).find(h => h.type === 'song')
      return song?.result?.url ?? null
    }

    // Keyless fallback — unofficial endpoint
    const res = await fetch(
      `https://genius.com/api/search/song?per_page=5&q=${encodeURIComponent(sanitizeQuery(query))}`,
      { headers: { 'User-Agent': DEFAULT_UA } }
    )
    if (!res.ok) return null
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
    const res = await fetch(url, { headers: { 'User-Agent': DEFAULT_UA } })
    if (!res.ok) return null
    const html = await res.text()

    const doc = parse(html)
    const containers = doc.querySelectorAll('[data-lyrics-container="true"]')
    if (!containers.length) return null

    const lyrics = containers
      .map(el => {
        el.querySelectorAll('br').forEach(br => br.replaceWith('\n'))
        return el.text
      })
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
  if (!url) return null
  return fetchGeniusLyrics(url)
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
