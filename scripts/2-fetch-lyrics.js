require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') })
const Genius = require('genius-lyrics')
const fs = require('fs')
const path = require('path')

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/top100-raw.json'), 'utf8'))
const client = new Genius.Client(process.env.GENIUS_ACCESS_TOKEN)

function extractSections(lyrics) {
  const blocks = lyrics.split(/\n(?=\s*\[)/)
  const sections = []

  for (const block of blocks) {
    const trimmedBlock = block.trim()
    if (!trimmedBlock) continue

    const header = trimmedBlock.match(/^\[([^\]]+)\]/)
    let label = 'unknown'
    if (header) {
      label = header[1].toLowerCase()
        .replace(/[:\d\s].*$/, '')
        .trim()
    }

    const content = trimmedBlock.replace(/^\[[^\]]+\]\n?/, '').trim()
    const lines = content
      .split('\n')
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

  // Fallback to first section with enough lines if no labeled chorus
  const source = chorus || sections[0]
  if (!source) return null

  return source.lines.slice(0, 4)
}

async function main() {
  const results = []

  for (const song of raw) {
    await new Promise(r => setTimeout(r, 200))
    try {
      const searches = await client.songs.search(`${song.title} ${song.artist}`)
      const match = searches[0]
      if (!match) { console.warn(`No Genius match: ${song.title}`); continue }

      const lyrics = await match.lyrics()
      const hook_lines = extractChorus(lyrics)

      if (!hook_lines) { console.warn(`Skipping — no chorus found: ${song.title}`); continue }

      results.push({ ...song, hook_lines })
      console.log(`✓ ${song.title}`)
    } catch (err) {
      console.warn(`Failed: ${song.title} — ${err.message}`)
    }
  }

  const out = path.join(__dirname, '../data/top100-with-lyrics.json')
  fs.writeFileSync(out, JSON.stringify(results, null, 2))
  console.log(`\nSaved ${results.length} songs with lyrics to data/top100-with-lyrics.json`)
}

main().catch(err => { console.error(err); process.exit(1) })
