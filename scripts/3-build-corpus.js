require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') })
const fs = require('fs')
const path = require('path')

function slugify(title, artist) {
  return `${title}-${artist}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const newSongsPath = path.join(__dirname, '../data/top100-with-lyrics.json')
const corpusPath = path.join(__dirname, '../src/data/corpus.json')

const newSongs = JSON.parse(fs.readFileSync(newSongsPath, 'utf8'))
const existing = fs.existsSync(corpusPath)
  ? JSON.parse(fs.readFileSync(corpusPath, 'utf8'))
  : []

const corpus = existing.map(s => ({ ...s, trending: false }))
const existingById = new Map(corpus.map((s, i) => [s.spotify_id, i]))

for (const song of newSongs) {
  if (existingById.has(song.spotify_id)) {
    const idx = existingById.get(song.spotify_id)
    corpus[idx].trending = true
    corpus[idx].preview_url = song.preview_url
  } else {
    corpus.push({
      id: slugify(song.title, song.artist),
      ...song,
    })
  }
}

fs.mkdirSync(path.join(__dirname, '../src/data'), { recursive: true })
fs.writeFileSync(corpusPath, JSON.stringify(corpus, null, 2))
console.log(`Corpus: ${corpus.length} songs total, ${newSongs.length} from current top 100`)
