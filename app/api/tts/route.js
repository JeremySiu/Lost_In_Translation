import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? 'JBFqnCBsd6RMkjVDRZzb'

let _client = null
function getClient() {
  if (!_client) {
    _client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY })
  }
  return _client
}

export async function POST(request) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ELEVENLABS_API_KEY not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await request.json().catch(() => ({}))
  const { text } = body
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'text required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data } = await getClient()
    .textToSpeech
    .convert(VOICE_ID, {
      text: text.trim(),
      modelId: 'eleven_v3',
    })
    .withRawResponse()

  return new Response(data, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  })
}
