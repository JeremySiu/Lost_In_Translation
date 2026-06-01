import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const LANGUAGE_POOL = [
  'Mandarin', 'Swahili', 'Finnish', 'Icelandic', 'Mongolian',
  'Yoruba', 'Georgian', 'Basque', 'Tamil', 'Quechua',
  'Latvian', 'Zulu', 'Kazakh', 'Welsh', 'Amharic',
]

function pickChain() {
  return [...LANGUAGE_POOL].sort(() => Math.random() - 0.5).slice(0, 4)
}

function slugify(title, artist) {
  return `${title}-${artist}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function getSpotifyToken() {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${process.env.SPOTIFY_CLIENT_ID}&client_secret=${process.env.SPOTIFY_CLIENT_SECRET}`,
  })
  return (await res.json()).access_token
}

async function fetchPlaylist(token, playlistId) {
  const res = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50&fields=items(track(id,name,artists,preview_url,album(release_date)))`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  return data.items?.map(i => i.track).filter(Boolean) ?? []
}

export async function GET() {
  try {
    // Step 1: fetch top 100
    const token = await getSpotifyToken()
    const [top50, next50] = await Promise.all([
      fetchPlaylist(token, '37i9dQZEVXbMDoHDwVN2tF'),
      fetchPlaylist(token, '37i9dQZEVXbNG2pokLBMGa'),
    ])
    const raw = [...top50, ...next50]
      .filter(t => t?.preview_url)
      .map((t, i) => ({
        chart_position: i + 1,
        spotify_id: t.id,
        title: t.name,
        artist: t.artists[0]?.name ?? 'Unknown',
        preview_url: t.preview_url,
        release_year: new Date(t.album?.release_date ?? '2020').getFullYear(),
        trending: true,
      }))

    // Step 2: lyrics via Genius — dynamic import (external package)
    const Genius = (await import('genius-lyrics')).default
    const geniusClient = new Genius.Client(process.env.GENIUS_ACCESS_TOKEN)
    const withLyrics = []

    for (const song of raw) {
      await new Promise(r => setTimeout(r, 200))
      try {
        const searches = await geniusClient.songs.search(`${song.title} ${song.artist}`)
        if (!searches[0]) continue
        const lyrics = await searches[0].lyrics()
        const lines = lyrics.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('[') && l.split(' ').length >= 4).slice(0, 4)
        if (lines.length < 4) continue
        withLyrics.push({ ...song, hook_lines: lines })
      } catch { /* skip */ }
    }

    // Step 3: merge corpus
    const corpusPath = path.join(process.cwd(), 'src/data/corpus.json')
    const existing = fs.existsSync(corpusPath) ? JSON.parse(fs.readFileSync(corpusPath, 'utf8')) : []
    const corpus = existing.map(s => ({ ...s, trending: false }))
    const existingById = new Map(corpus.map((s, i) => [s.spotify_id, i]))

    for (const song of withLyrics) {
      if (existingById.has(song.spotify_id)) {
        const idx = existingById.get(song.spotify_id)
        corpus[idx].trending = true
        corpus[idx].preview_url = song.preview_url
      } else {
        corpus.push({ id: slugify(song.title, song.artist), ...song, language_chain: pickChain() })
      }
    }

    fs.mkdirSync(path.dirname(corpusPath), { recursive: true })
    fs.writeFileSync(corpusPath, JSON.stringify(corpus, null, 2))

    // Trigger redeploy
    if (process.env.VERCEL_DEPLOY_HOOK_URL) {
      await fetch(process.env.VERCEL_DEPLOY_HOOK_URL, { method: 'POST' })
    }

    return NextResponse.json({
      total: corpus.length,
      trending: corpus.filter(s => s.trending).length,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
