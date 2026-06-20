import { NextResponse } from 'next/server'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { computeAdaptiveParams, buildManglePrompt, pickChain } from '../../../src/lib/adaptive'
import { getPlaylistSong } from '../../../src/lib/playlistCache'

let corpus = []
try {
  corpus = (await import('../../../src/data/corpus.json')).default
} catch {
  corpus = []
}
const corpusById = new Map(corpus.map(s => [s.id, s]))

let _model = null
function getModel() {
  if (!_model) {
    _model = new ChatGoogleGenerativeAI({
      model: 'gemini-2.5-flash',
      temperature: 0.7,
    })
  }
  return _model
}

async function mangleSong(song, difficulty, roundNumber) {
  const model = getModel()
  const language_chain = pickChain(difficulty)
  const prompt = buildManglePrompt(song.hook_lines, language_chain, difficulty)

  const response = await model.invoke(
    [{ role: 'user', content: prompt }],
    {
      metadata: {
        songId: song.id,
        difficulty,
        roundNumber,
      },
      runName: `mangle:${song.id}`,
      tags: ['mangle', difficulty],
    }
  )

  const text = typeof response.content === 'string'
    ? response.content
    : response.content?.[0]?.text ?? ''

  // Strip markdown code fences if present
  const cleaned = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()

  let mangled_lines
  try {
    mangled_lines = JSON.parse(cleaned)
    if (!Array.isArray(mangled_lines) || mangled_lines.length !== song.hook_lines.length) {
      throw new Error('Invalid array length')
    }
    // Ensure all strings are non-empty
    if (mangled_lines.some(l => typeof l !== 'string' || l.trim().length === 0)) {
      throw new Error('Empty line in response')
    }
  } catch {
    // Retry once with a stricter prompt
    const retryResponse = await model.invoke(
      [{
        role: 'user',
        content: prompt + '\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY a JSON array with no other text.',
      }],
      { runName: `mangle-retry:${song.id}`, tags: ['mangle', 'retry'] }
    )
    const retryText = typeof retryResponse.content === 'string'
      ? retryResponse.content
      : retryResponse.content?.[0]?.text ?? ''
    const retryCleaned = retryText.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()

    try {
      mangled_lines = JSON.parse(retryCleaned)
      if (!Array.isArray(mangled_lines) || mangled_lines.length !== song.hook_lines.length) {
        throw new Error('Still invalid')
      }
    } catch {
      // Last resort: return original hook_lines unmangled
      mangled_lines = song.hook_lines
    }
  }

  return { id: song.id, mangled_lines, language_chain }
}

function mockMangleSong(song) {
  const language_chain = ['Spanish', 'Japanese', 'English']
  const mangled_lines = song.hook_lines.map((line, i) => {
    const mocks = [
      `[mock] ${line.split(' ').reverse().join(' ')}`,
      `[mock] ${line.replace(/[aeiou]/gi, '*')}`,
      `[mock] ${line.toUpperCase()}`,
      `[mock] ${line.split('').sort(() => 0.5 - Math.random()).join('')}`,
    ]
    return mocks[i % mocks.length]
  })
  return { id: song.id, mangled_lines, language_chain }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  const { songs = [], performanceHistory = [], roundNumber = 1 } = body

  if (!Array.isArray(songs) || songs.length === 0) {
    return NextResponse.json({ error: 'songs array required' }, { status: 400 })
  }

  const { difficulty, clip_duration_ms } = computeAdaptiveParams(performanceHistory, roundNumber)

  // Resolve hook_lines server-side — client only sends song IDs
  const songsWithHooks = songs.map(s => {
    const full = corpusById.get(s.id ?? s) ?? getPlaylistSong(s.id ?? s)
    return full ? { ...s, hook_lines: full.hook_lines } : s
  }).filter(s => s.hook_lines?.length)

  if (songsWithHooks.length === 0) {
    return NextResponse.json({ error: 'no valid song IDs' }, { status: 400 })
  }

  if (process.env.MOCK_MANGLE === 'true') {
    const mangledSongs = songsWithHooks.map(mockMangleSong)
    return NextResponse.json({ difficulty, clip_duration_ms, songs: mangledSongs })
  }

  const mangledSongs = await Promise.all(
    songsWithHooks.map(song => mangleSong(song, difficulty, roundNumber))
  )

  return NextResponse.json({ difficulty, clip_duration_ms, songs: mangledSongs })
}
