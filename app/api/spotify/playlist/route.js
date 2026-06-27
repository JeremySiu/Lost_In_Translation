import { NextResponse } from 'next/server'
import { encryptHookLines } from '../../../../src/lib/hookLinesCrypto'
import { getLrclibHookLines } from '../../../../src/lib/lrclibLyrics'

// Allow up to 60 seconds on Vercel Pro (the enrichment pipeline calls
// Spotify embed + iTunes + lrclib for each of the 5 songs in parallel).
export const maxDuration = 60

const SONGS_PER_ROUND = 5

function slugify(title, artist) {
  return `${title}-${artist}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function normalize(s) {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Spotify ─────────────────────────────────────────────────────────────────

function parsePlaylistId(url) {
  if (typeof url !== 'string') return null
  // Accept full URLs, spotify: URIs, and bare IDs
  const match = url.match(/playlist[/:]([A-Za-z0-9]+)/)
  if (match) return match[1]
  const bare = url.trim().match(/^[A-Za-z0-9]+$/)
  return bare ? bare[0] : null
}

// Spotify's Client Credentials flow can no longer read playlist tracks for apps
// registered after Nov 2024 (the /tracks endpoint returns 403 and the `tracks`
// field is stripped from the playlist object). The public embed page does not
// require auth and exposes the track list via its embedded __NEXT_DATA__ JSON.
async function fetchPlaylistTracks(playlistId) {
  const res = await fetch(`https://open.spotify.com/embed/playlist/${playlistId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (!res.ok) {
    const err = new Error(`Spotify embed fetch failed (${res.status})`)
    err.status = res.status
    throw err
  }

  const html = await res.text()
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match) {
    const err = new Error('Could not parse playlist page')
    err.status = 404
    throw err
  }

  let entity
  try {
    const data = JSON.parse(match[1])
    entity = data?.props?.pageProps?.state?.data?.entity
  } catch {
    const err = new Error('Could not parse playlist data')
    err.status = 404
    throw err
  }

  const trackList = entity?.trackList
  if (!Array.isArray(trackList)) {
    const err = new Error('Playlist not found or not public')
    err.status = 404
    throw err
  }

  const tracks = []
  for (const t of trackList) {
    // `title` is the track name; `subtitle` is the artist (comma-separated for collabs).
    const title = t?.title
    const artist = (t?.subtitle ?? '').split(',')[0].trim()
    if (title && artist) tracks.push({ title, artist })
  }
  return tracks
}

// ── iTunes (mirrors cron/refresh-corpus) ──────────────────────────────────────

async function itunesSearch(title, artist) {
  const q = encodeURIComponent(`${title} ${artist}`)
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=song&limit=5`)
    if (!res.ok) return null
    const data = await res.json()
    const candidates = (data.results ?? []).filter(r => r.previewUrl)
    if (!candidates.length) return null

    const targetArtist = normalize(artist)
    const targetTitle = normalize(title)

    const score = r => {
      const a = normalize(r.artistName)
      const t = normalize(r.trackName)
      const artistMatch = a.includes(targetArtist) || targetArtist.includes(a)
      const titleMatch = t.includes(targetTitle) || targetTitle.includes(t)
      return (artistMatch ? 2 : 0) + (titleMatch ? 1 : 0)
    }

    const best = candidates.reduce((a, b) => (score(a) >= score(b) ? a : b))
    return {
      preview_url: best.previewUrl,
      title: best.trackName,
      artist: best.artistName,
      release_year: new Date(best.releaseDate ?? '2020').getFullYear(),
      album_art_url: best.artworkUrl100 ? best.artworkUrl100.replace('100x100bb', '600x600bb') : null,
    }
  } catch {
    return null
  }
}

async function verifyPreviewUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

// ── lrclib hook-line extraction ───────────────────────────────────────────────

async function fetchHookLines(title, artist) {
  const lines = await getLrclibHookLines(title, artist)
  if (!lines?.length) console.warn(`[playlist] no hook lines for "${title}" by "${artist}"`)
  return lines ?? null
}

// ── Enrichment ────────────────────────────────────────────────────────────────

// Phase 1 helper: resolve iTunes metadata (safe to parallelise — iTunes is
// lenient about concurrency).
async function resolveItunes(track) {
  const itunes = await itunesSearch(track.title, track.artist)
  if (!itunes?.preview_url) return null
  if (!(await verifyPreviewUrl(itunes.preview_url))) return null
  return itunes
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  const playlistId = parsePlaylistId(body.playlistUrl)

  if (!playlistId) {
    return NextResponse.json({ error: 'Invalid Spotify playlist URL.' }, { status: 400 })
  }

  let tracks
  try {
    tracks = await fetchPlaylistTracks(playlistId)
  } catch (err) {
    if (err.status === 404 || err.status === 403) {
      return NextResponse.json(
        { error: 'Could not access that playlist. Make sure it is public and the link is correct.' },
        { status: 404 }
      )
    }
    return NextResponse.json({ error: 'Failed to fetch playlist from Spotify.' }, { status: 502 })
  }

  if (!tracks.length) {
    return NextResponse.json({ error: 'That playlist has no songs.' }, { status: 400 })
  }

  // Enrich candidates fully in parallel — iTunes + lrclib run simultaneously
  // across all candidates (capped at SONGS_PER_ROUND * 3 to keep the request
  // count reasonable). Using native fetch means no undici/rate-limit issues.
  const shuffled = shuffle(tracks)
  const candidates = shuffled.slice(0, Math.min(shuffled.length, SONGS_PER_ROUND * 3))

  const enrichResults = await Promise.allSettled(
    candidates.map(async t => {
      const itunes = await resolveItunes(t)
      if (!itunes) return null
      const hook_lines = await fetchHookLines(itunes.title, itunes.artist)
      if (!hook_lines?.length) return null
      return {
        id: `playlist-${slugify(itunes.title, itunes.artist)}`,
        title: itunes.title,
        artist: itunes.artist,
        preview_url: itunes.preview_url,
        album_art_url: itunes.album_art_url,
        release_year: itunes.release_year,
        trending: false,
        hook_lines,
      }
    })
  )

  const seen = new Set()
  const enriched = []
  for (const r of enrichResults) {
    if (enriched.length >= SONGS_PER_ROUND) break
    if (r.status !== 'fulfilled' || !r.value) continue
    if (seen.has(r.value.id)) continue
    seen.add(r.value.id)
    enriched.push(r.value)
  }

  console.log(`[playlist] enriched ${enriched.length}/${candidates.length} candidates`)

  if (enriched.length < SONGS_PER_ROUND) {
    return NextResponse.json(
      { error: 'Not enough playable songs found. Try a larger playlist.' },
      { status: 422 }
    )
  }

  // Encrypt hook_lines into a token the client holds and passes back to
  // /api/mangle and /api/songs/[id]/reveal.  The client never sees the raw
  // lyrics, preventing cheating while keeping the app fully stateless.
  const sanitised = enriched.map(({ hook_lines, ...rest }) => ({
    ...rest,
    hook_token: encryptHookLines(hook_lines),
  }))

  return NextResponse.json(sanitised)
}
