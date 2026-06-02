import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

function slugify(title, artist) {
  return `${title}-${artist}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ── Step 1: Last.fm + iTunes (mirrors 1-fetch-top100.js) ─────────────────────

async function getLastFmTopTracks(limit = 100) {
  const url = `https://ws.audioscrobbler.com/2.0/?method=chart.gettoptracks&api_key=${process.env.LASTFM_API_KEY}&limit=${limit}&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Last.fm failed (${res.status})`)
  const data = await res.json()
  if (data.error) throw new Error(`Last.fm error: ${data.message}`)
  return data.tracks?.track ?? []
}

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

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

    const best = candidates.reduce((a, b) => score(a) >= score(b) ? a : b)
    return {
      preview_url: best.previewUrl,
      title: best.trackName,
      artist: best.artistName,
      release_year: new Date(best.releaseDate ?? '2020').getFullYear(),
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

async function fetchTop100() {
  const tracks = await getLastFmTopTracks(100)

  const matched = []
  for (let i = 0; i < tracks.length; i += 5) {
    const batch = tracks.slice(i, i + 5)
    const results = await Promise.all(batch.map(t => itunesSearch(t.name, t.artist?.name)))
    for (let j = 0; j < results.length; j++) {
      if (results[j]) matched.push({ lastFm: batch[j], itunes: results[j] })
    }
    await new Promise(r => setTimeout(r, 200))
  }

  const verified = []
  for (let i = 0; i < matched.length; i += 10) {
    const batch = matched.slice(i, i + 10)
    const checks = await Promise.all(batch.map(t => verifyPreviewUrl(t.itunes.preview_url)))
    for (let j = 0; j < batch.length; j++) {
      if (checks[j]) verified.push(batch[j])
    }
  }

  return verified.map(({ itunes }, i) => ({
    chart_position: i + 1,
    spotify_id: `lastfm_${i}`,
    title: itunes.title,
    artist: itunes.artist,
    preview_url: itunes.preview_url,
    release_year: itunes.release_year,
    trending: true,
  }))
}

// ── Step 2: Genius chorus extraction (mirrors 2-fetch-lyrics.js) ──────────────

function extractSections(lyrics) {
  const blocks = lyrics.split(/\n(?=\s*\[)/)
  const sections = []
  for (const block of blocks) {
    const trimmedBlock = block.trim()
    if (!trimmedBlock) continue
    const header = trimmedBlock.match(/^\[([^\]]+)\]/)
    let label = 'unknown'
    if (header) {
      label = header[1].toLowerCase().replace(/[:\d\s].*$/, '').trim()
    }
    const content = trimmedBlock.replace(/^\[[^\]]+\]\n?/, '').trim()
    const lines = content.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('[') && l.split(/\s+/).length >= 2)
    if (lines.length >= 4) sections.push({ label, lines })
  }
  return sections
}

function extractChorus(lyrics) {
  const sections = extractSections(lyrics)
  const chorusLabels = ['chorus', 'hook', 'refrain']
  const chorus = sections.find(s => chorusLabels.includes(s.label))
  const source = chorus || sections[0]
  if (!source) return null
  return source.lines.slice(0, 4)
}

async function fetchLyrics(songs) {
  const Genius = (await import('genius-lyrics')).default
  const geniusClient = new Genius.Client(process.env.GENIUS_ACCESS_TOKEN)
  const results = []
  for (const song of songs) {
    await new Promise(r => setTimeout(r, 200))
    try {
      const searches = await geniusClient.songs.search(`${song.title} ${song.artist}`)
      if (!searches[0]) continue
      const lyrics = await searches[0].lyrics()
      const hook_lines = extractChorus(lyrics)
      if (!hook_lines) continue
      results.push({ ...song, hook_lines })
    } catch { /* skip */ }
  }
  return results
}

// ── Step 3: Merge corpus (mirrors 3-build-corpus.js) ─────────────────────────

function mergeCorpus(newSongs, corpusPath) {
  const existing = fs.existsSync(corpusPath) ? JSON.parse(fs.readFileSync(corpusPath, 'utf8')) : []
  const corpus = existing.map(s => ({ ...s, trending: false }))
  const existingById = new Map(corpus.map((s, i) => [s.spotify_id, i]))
  for (const song of newSongs) {
    if (existingById.has(song.spotify_id)) {
      const idx = existingById.get(song.spotify_id)
      corpus[idx].trending = true
      corpus[idx].preview_url = song.preview_url
    } else {
      corpus.push({ id: slugify(song.title, song.artist), ...song })
    }
  }
  return corpus
}

// ── Step 4: Album art enrichment (mirrors 4-enrich-album-art.js) ──────────────

async function fetchArtwork(title, artist) {
  const q = encodeURIComponent(`${title} ${artist}`)
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=song&limit=1`)
    if (!res.ok) return null
    const data = await res.json()
    const result = data.results?.[0]
    if (!result?.artworkUrl100) return null
    return result.artworkUrl100.replace('100x100bb', '600x600bb')
  } catch {
    return null
  }
}

async function enrichAlbumArt(corpus) {
  for (const song of corpus) {
    if (song.album_art_url) continue
    const art = await fetchArtwork(song.title, song.artist)
    if (art) song.album_art_url = art
    await new Promise(r => setTimeout(r, 200))
  }
  return corpus
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const raw = await fetchTop100()
    const withLyrics = await fetchLyrics(raw)

    const corpusPath = path.join(process.cwd(), 'src/data/corpus.json')
    fs.mkdirSync(path.dirname(corpusPath), { recursive: true })

    const merged = mergeCorpus(withLyrics, corpusPath)
    const corpus = await enrichAlbumArt(merged)

    fs.writeFileSync(corpusPath, JSON.stringify(corpus, null, 2))

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
