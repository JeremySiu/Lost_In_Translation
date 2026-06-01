import { NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

const MAX_SCORE = 5000 // 5 songs × 500pts × 2x streak cap

export async function GET() {
  try {
    const raw = await kv.zrange('leaderboard', 0, 9, { rev: true, withScores: true })
    // raw alternates: [member, score, member, score, ...]
    const entries = []
    for (let i = 0; i < raw.length; i += 2) {
      try {
        const parsed = JSON.parse(raw[i])
        entries.push({ ...parsed, score: raw[i + 1] })
      } catch {
        entries.push({ initials: '???', score: raw[i + 1], date: 0 })
      }
    }
    return NextResponse.json(entries)
  } catch (err) {
    return NextResponse.json({ error: 'KV unavailable' }, { status: 503 })
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  const { initials, score } = body

  if (!initials || typeof score !== 'number' || score < 0 || score > MAX_SCORE) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const safeInitials = String(initials).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)
  if (safeInitials.length === 0) return NextResponse.json({ error: 'Invalid initials' }, { status: 400 })

  const member = JSON.stringify({ initials: safeInitials, score, date: Date.now() })
  await kv.zadd('leaderboard', { score, member })
  return NextResponse.json({ ok: true })
}
