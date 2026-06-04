import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const MAX_SCORE = 5000 // 5 songs × 500pts × 2x streak cap

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  try {
    return createClient(url, key)
  } catch {
    return null
  }
}

export async function GET(request) {
  const supabase = getSupabase()
  if (!supabase) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 })

  const { searchParams } = new URL(request.url)
  const scoreParam = searchParams.get('score')
  const playerScore = scoreParam !== null ? Number(scoreParam) : null

  const { data, error } = await supabase
    .from('Leaderboard')
    .select('initials, score, created_at')
    .order('score', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 })

  const entries = data.map(row => ({
    initials: row.initials,
    score: row.score,
    date: new Date(row.created_at).getTime(),
  }))

  if (playerScore === null) return NextResponse.json({ entries })

  const { count } = await supabase
    .from('Leaderboard')
    .select('*', { count: 'exact', head: true })
    .gt('score', playerScore)

  return NextResponse.json({ entries, playerRank: (count ?? 0) + 1 })
}

export async function POST(request) {
  const supabase = getSupabase()
  if (!supabase) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const { initials, score } = body

  if (!initials || typeof score !== 'number' || score < 0 || score > MAX_SCORE) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const safeInitials = String(initials).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)
  if (safeInitials.length === 0) return NextResponse.json({ error: 'Invalid initials' }, { status: 400 })

  const { error } = await supabase
    .from('Leaderboard')
    .insert({ initials: safeInitials, score })

  if (error) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 })

  return NextResponse.json({ ok: true })
}
