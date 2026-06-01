import { NextResponse } from 'next/server'

let corpus = []
try {
  corpus = (await import('../../../../../src/data/corpus.json')).default
} catch {
  corpus = []
}

export async function GET(request, { params }) {
  const song = corpus.find(s => s.id === params.id)
  if (!song) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    hook_lines: song.hook_lines,
    album_art_url: song.album_art_url ?? null,
    preview_url: song.preview_url ?? null,
  })
}
