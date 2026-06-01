const fs = require('fs')
const path = require('path')

const corpusPath = path.join(__dirname, '../src/data/corpus.json')
const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'))

async function fetchArtwork(title, artist) {
  const q = encodeURIComponent(`${title} ${artist}`)
  const url = `https://itunes.apple.com/search?term=${q}&entity=song&limit=1`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const result = data.results?.[0]
    if (!result?.artworkUrl100) return null
    // Upgrade to 600x600
    return result.artworkUrl100.replace('100x100bb', '600x600bb')
  } catch {
    return null
  }
}

async function main() {
  let updated = 0
  for (const song of corpus) {
    if (song.album_art_url) continue
    const art = await fetchArtwork(song.title, song.artist)
    if (art) {
      song.album_art_url = art
      updated++
      process.stdout.write(`✓ ${song.title} — ${song.artist}\n`)
    } else {
      process.stdout.write(`✗ ${song.title} — ${song.artist}\n`)
    }
    // Rate limit
    await new Promise(r => setTimeout(r, 200))
  }
  fs.writeFileSync(corpusPath, JSON.stringify(corpus, null, 2))
  console.log(`\nDone. Updated ${updated} songs.`)
}

main()
