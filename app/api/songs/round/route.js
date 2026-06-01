import { NextResponse } from 'next/server'
import { pickRound } from '../../../../src/lib/corpus'

let corpus = []
try {
  corpus = (await import('../../../../src/data/corpus.json')).default
} catch {
  corpus = []
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const seen = searchParams.get('seen') || ''
  const seenIds = new Set(seen.split(',').filter(Boolean))

  const selected = pickRound(corpus, seenIds)

  // Strip hook_lines — only sent via /reveal after song is resolved
  const sanitised = selected.map(({ hook_lines, ...rest }) => rest)
  return NextResponse.json(sanitised)
}
