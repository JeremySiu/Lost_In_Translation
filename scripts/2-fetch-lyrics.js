require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') })
const Genius = require('genius-lyrics')
const fs = require('fs')
const path = require('path')

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/top100-raw.json'), 'utf8'))
const client = new Genius.Client(process.env.GENIUS_ACCESS_TOKEN)

// Returns all labeled sections as { label, lines[] }
function extractAllSections(lyrics) {
  const blocks = lyrics.split(/\n{2,}/)
  const sections = []

  for (const block of blocks) {
    const header = block.match(/^\[([^\]]+)\]/)
    const label = header ? header[1].toLowerCase() : 'unknown'
    const content = block.replace(/^\[[^\]]+\]\n?/, '').trim()
    const lines = content
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('[') && l.split(' ').length >= 4)
    if (lines.length >= 4) sections.push({ label, lines })
  }

  // Fallback: if no labeled sections, split into 4-line chunks
  if (sections.length === 0) {
    const allLines = lyrics
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('[') && l.split(' ').length >= 4)
    for (let i = 0; i < allLines.length; i += 4) {
      const chunk = allLines.slice(i, i + 4)
      if (chunk.length === 4) sections.push({ label: `chunk_${i}`, lines: chunk })
    }
  }

  return sections
}

// Returns all labeled sections as { label, lines[] }
function extractAllSections(lyrics) {
  // Split sections by double or more newlines, or lines that strictly begin with brackets
  const blocks = lyrics.split(/\n(?=\s*\[)/); 
  const sections = [];

  for (const block of blocks) {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) continue;

    const header = trimmedBlock.match(/^\[([^\]]+)\]/);
    
    // Normalize header labels by stripping out numbers and features (e.g., "chorus: drake" -> "chorus")
    let label = 'unknown';
    if (header) {
      label = header[1].toLowerCase()
        .replace(/[:\d\s].*$/, '') // turns "chorus 1" or "chorus: drake" into "chorus"
        .trim();
    }
    
    const content = trimmedBlock.replace(/^\[[^\]]+\]\n?/, '').trim();
    const lines = content
      .split('\n')
      .map(l => l.trim())
      // Loosened restriction: Allow shorter lines typical of modern choruses (2+ words)
      .filter(l => l.length > 0 && !l.startsWith('[') && l.split(/\s+/).length >= 2); 
      
    if (lines.length >= 4) {
      sections.push({ label, lines });
    }
  }

  // Fallback: if no labeled sections, split into 4-line chunks
  if (sections.length === 0) {
    const allLines = lyrics
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('[') && l.split(/\s+/).length >= 2);
    for (let i = 0; i < allLines.length; i += 4) {
      const chunk = allLines.slice(i, i + 4);
      if (chunk.length === 4) sections.push({ label: `chunk_${i}`, lines: chunk });
    }
  }

  return sections;
}

function similarity(setA, setB) {
  const wordsA = new Set(setA.join(' ').toLowerCase().split(/\s+/));
  const wordsB = new Set(setB.join(' ').toLowerCase().split(/\s+/));
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 1 : intersection / union;
}

// Pick up to 3 distinct 4-line sets prioritizing choruses
function pickLyricSets(sections) {
  const sets = [];
  
  // Track assigned sections by reference index instead of string label to prevent collisions
  const usedIndices = new Set();

  // Unified, progressive matching rules
  const matchingRules = [
    s => s.label === 'chorus' || s.label === 'hook' || s.label === 'refrain',
    s => s.label === 'verse',
    s => true // Catch-all fallback for any remaining section (Intro, Outro, Bridge, etc.)
  ];

  for (const test of matchingRules) {
    // Collect matches for the current rule type
    const matches = sections.filter((s, idx) => !usedIndices.has(idx) && test(s));
    
    for (const match of matches) {
      if (sets.length >= 3) break;

      const candidate = match.lines.slice(0, 4);
      if (sets.some(s => similarity(s, candidate) >= 0.6)) continue;

      const matchIdx = sections.indexOf(match);
      usedIndices.add(matchIdx);
      sets.push(candidate);
    }
    if (sets.length >= 3) break;
  }

  return sets.length >= 2 ? sets : null; // Require at least 2 distinct sets
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
      const sections = extractAllSections(lyrics)
      const lyric_sets = pickLyricSets(sections)

      if (!lyric_sets) { console.warn(`Skipping — can't extract 2+ sets: ${song.title}`); continue }

      // hook_lines remains the first set (chorus) for backward compatibility
      results.push({ ...song, hook_lines: lyric_sets[0], lyric_sets })
      console.log(`✓ ${song.title} — ${lyric_sets.length} sets`)
    } catch (err) {
      console.warn(`Failed: ${song.title} — ${err.message}`)
    }
  }

  const out = path.join(__dirname, '../data/top100-with-lyrics.json')
  fs.writeFileSync(out, JSON.stringify(results, null, 2))
  console.log(`\nSaved ${results.length} songs with lyrics to data/top100-with-lyrics.json`)
}

main().catch(err => { console.error(err); process.exit(1) })
