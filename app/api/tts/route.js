const VOICE_ID = process.env.GRADIUM_VOICE_ID

export async function POST(request) {
  const apiKey = process.env.GRADIUM_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GRADIUM_API_KEY not configured' }), {
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

  const res = await fetch('https://api.gradium.ai/api/post/speech/tts', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: text.trim(),
      voice_id: VOICE_ID,
      output_format: 'wav',
      only_audio: true,
    }),
  })

  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'TTS request failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const audio = await res.arrayBuffer()
  return new Response(audio, {
    headers: {
      'Content-Type': 'audio/wav',
      'Cache-Control': 'no-store',
    },
  })
}
