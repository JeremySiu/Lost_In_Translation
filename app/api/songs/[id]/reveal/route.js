import { NextResponse } from 'next/server'
import { decryptHookLines } from '../../../../../src/lib/hookLinesCrypto'

let corpus = []
try {
  corpus = (await import('../../../../../src/data/corpus.json')).default
} catch {
  corpus = []
}

export async function GET(request, { params }) {
  const corpusSong = corpus.find(s => s.id === params.id)
  if (corpusSong) {
    return NextResponse.json({
      hook_lines: corpusSong.hook_lines,
      album_art_url: corpusSong.album_art_url ?? null,
      preview_url: corpusSong.preview_url ?? null,
    })
  }

  // Playlist song: hook_lines were encrypted client-side as hook_token.
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('hook_token')
  if (!token) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const hook_lines = decryptHookLines(token)
  if (!hook_lines) return NextResponse.json({ error: 'Invalid token' }, { status: 400 })

  // album_art_url and preview_url are already in the client's song object for
  // playlist songs, so we don't need to return them here, but we include
  // nulls so the response shape stays consistent.
  return NextResponse.json({
    hook_lines,
    album_art_url: null,
    preview_url: null,
  })
}
