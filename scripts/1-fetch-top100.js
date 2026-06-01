require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') })
const fs = require('fs')
const path = require('path')

// ── Last.fm: get top trending tracks ─────────────────────────────────────────

async function getLastFmTopTracks(limit = 100) {
  const url = `https://ws.audioscrobbler.com/2.0/?method=chart.gettoptracks&api_key=${process.env.LASTFM_API_KEY}&limit=${limit}&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Last.fm failed (${res.status})`)
  const data = await res.json()
  if (data.error) throw new Error(`Last.fm error: ${data.message}`)
  return data.tracks?.track ?? []
}

// ── iTunes: search for a track and get a 30s preview URL ─────────────────────

async function itunesSearch(title, artist) {
  const q = encodeURIComponent(`${title} ${artist}`)
  const url = `https://itunes.apple.com/search?term=${q}&entity=song&limit=1`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const result = data.results?.[0]
    if (!result || !result.previewUrl) return null
    return {
      preview_url: result.previewUrl,
      title: result.trackName,
      artist: result.artistName,
      release_year: new Date(result.releaseDate ?? '2020').getFullYear(),
    }
  } catch {
    return null
  }
}

// ── Verify preview URL actually responds ──────────────────────────────────────

async function verifyPreviewUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const lastFmTracks = await getLastFmTopTracks(100)
  console.log(`Last.fm returned ${lastFmTracks.length} trending tracks`)

  // Debug: show first 3 matches
  console.log('\nDebug — first 3 tracks:')
  for (const t of lastFmTracks.slice(0, 3)) {
    const match = await itunesSearch(t.name, t.artist?.name)
    console.log(` Last.fm: "${t.name}" by "${t.artist?.name}"`)
    console.log(` iTunes:  ${match ? `"${match.title}" — ${match.preview_url}` : 'no match'}`)
  }
  console.log()

  // Search iTunes for all tracks (5 at a time to avoid rate limits)
  console.log('Fetching iTunes preview URLs...')
  const matched = []
  for (let i = 0; i < lastFmTracks.length; i += 5) {
    const batch = lastFmTracks.slice(i, i + 5)
    const results = await Promise.all(
      batch.map(t => itunesSearch(t.name, t.artist?.name))
    )
    for (let j = 0; j < results.length; j++) {
      const r = results[j]
      if (!r) continue
      matched.push({ lastFm: batch[j], itunes: r })
    }
    process.stdout.write(`\r  Matched ${matched.length} tracks (checked ${Math.min(i + 5, lastFmTracks.length)}/${lastFmTracks.length})`)
    await new Promise(r => setTimeout(r, 200)) // iTunes rate limit
  }
  console.log()

  // Verify each preview URL
  console.log('Verifying preview URLs...')
  const verified = []
  for (let i = 0; i < matched.length; i += 10) {
    const batch = matched.slice(i, i + 10)
    const checks = await Promise.all(batch.map(t => verifyPreviewUrl(t.itunes.preview_url)))
    for (let j = 0; j < batch.length; j++) {
      if (checks[j]) verified.push(batch[j])
    }
    process.stdout.write(`\r  Verified ${verified.length}/${matched.length}`)
  }
  console.log()

  const output = verified.map(({ lastFm, itunes }, i) => ({
    chart_position: i + 1,
    spotify_id: `lastfm_${i}`, // no Spotify ID needed — preview comes from iTunes
    title: itunes.title,
    artist: itunes.artist,
    preview_url: itunes.preview_url,
    release_year: itunes.release_year,
    trending: true,
  }))

  fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true })
  const out = path.join(__dirname, '../data/top100-raw.json')
  fs.writeFileSync(out, JSON.stringify(output, null, 2))
  console.log(`\nSaved ${output.length} verified tracks to data/top100-raw.json`)
}

main().catch(err => { console.error(err.message); process.exit(1) })
