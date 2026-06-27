const LANGUAGE_POOL = [
  'Mandarin', 'Swahili', 'Finnish', 'Icelandic', 'Mongolian',
  'Yoruba', 'Georgian', 'Basque', 'Tamil', 'Quechua',
  'Latvian', 'Zulu', 'Kazakh', 'Welsh', 'Amharic',
]

const START_CLIP_MS = 5000
const MIN_CLIP_MS = 300
const MAX_CLIP_MS = 10000

function songPerformanceRatio(p) {
  const maxScore = 500
  const scoreRatio = Math.min(p.score / maxScore, 1)

  // Exponential decay: sub-8s stays near max; drops sharply after ~20s
  const timeRatio = Math.max(0, Math.min(1, Math.exp(-Math.max(0, p.timeToGuessSeconds - 8) / 12)))

  // Exponential: 0 hints = 1.0, each hint cuts credit sharply (~0.43, ~0.18, …)
  const hintRatio = Math.max(0, Math.min(1, Math.exp(-p.hintsUsed * 0.85)))

  const wrongRatio = Math.max(0, Math.min(1, Math.exp(-p.wrongGuesses * 0.7)))

  return (
    scoreRatio * 0.2 +
    timeRatio * 0.35 +
    hintRatio * 0.3 +
    wrongRatio * 0.15
  )
}

function targetClipFromRatio(performanceRatio) {
  return Math.round(MIN_CLIP_MS + (MAX_CLIP_MS - MIN_CLIP_MS) * Math.pow(1 - performanceRatio, 2.8))
}

/** Weighted performance ratio from prior song results (0 = struggling, 1 = acing). */
export function computePerformanceRatio(performanceHistory = []) {
  if (performanceHistory.length === 0) return 0

  const scores = performanceHistory.map(songPerformanceRatio)
  let weightedSum = 0
  let weightTotal = 0
  scores.forEach((score, i) => {
    const weight = 1 + i * 0.4
    weightedSum += score * weight
    weightTotal += weight
  })
  return weightedSum / weightTotal
}

/** Clip length for the next song given prior results. Same formula the mangle API uses. */
export function computeClipDurationMs(performanceHistory = []) {
  if (performanceHistory.length === 0) return START_CLIP_MS
  const n = performanceHistory.length
  // Only look at the last 3 songs so the clip recovers quickly when a player
  // starts struggling again after an early lucky song.
  const recentHistory = performanceHistory.slice(-3)
  // Ramp to full adaptive effect over the first 4 songs so a single outlier
  // result can't immediately floor or ceiling the clip.
  const rampFactor = Math.min(n / 4, 1)
  const targetMs = targetClipFromRatio(computePerformanceRatio(recentHistory))
  return Math.round(START_CLIP_MS + (targetMs - START_CLIP_MS) * rampFactor)
}

/**
 * Compute difficulty tier and clip duration from session performance history.
 * Each entry in performanceHistory: { score, timeToGuessSeconds, hintsUsed, wrongGuesses }
 */
export function computeAdaptiveParams(performanceHistory = [], roundNumber = 1) {
  if (performanceHistory.length === 0) {
    return { difficulty: 'medium', clip_duration_ms: START_CLIP_MS }
  }

  const performanceRatio = computePerformanceRatio(performanceHistory)

  let difficulty
  if (performanceRatio >= 0.72) difficulty = 'very_hard'
  else if (performanceRatio >= 0.50) difficulty = 'hard'
  else if (performanceRatio >= 0.32) difficulty = 'medium'
  else if (performanceRatio >= 0.15) difficulty = 'easy'
  else difficulty = 'very_easy'

  const clip_duration_ms = computeClipDurationMs(performanceHistory)

  return { difficulty, clip_duration_ms }
}

export function buildManglePrompt(hookLines, languageChain, difficulty) {
  const instructions = {
    very_easy: `Minimal mangling. Swap a few words for near-synonyms only. Keep the original rhythm and structure completely intact. A casual listener should recognise the song instantly.`,
    easy: `Light mangling. Replace some key words with slightly formal synonyms; preserve sentence structure. The emotional meaning must remain obvious after one read.`,
    medium: `Moderate mangling. Use overly literal or bureaucratic phrasing throughout. Meaning is still deducible but requires real thought.`,
    hard: `Heavy mangling. Rewrite using highly formal, academic, or clinical register. Every line should take significant effort to decode back to the original.`,
    very_hard: `Maximum mangling. The original meaning must be extremely obscure. Use the most indirect, convoluted phrasing possible while technically preserving meaning. A player who knows the song well should still struggle.`,
  }

  const difficultyLabel = {
    very_easy: 'VERY EASY — player is struggling significantly, make output as recognisable as possible',
    easy: 'EASY — player is having difficulty, keep mangling gentle and meaning clear',
    medium: 'MEDIUM — player is performing averagely, balanced mangling',
    hard: 'HARD — player is doing well, make this challenging',
    very_hard: 'VERY HARD — player is acing the game, make this as obscure as possible',
  }

  return `You are a language mangling engine for a music guessing game.

Simulate translating these lyrics through: English → ${languageChain.join(' → ')} → English

Difficulty: ${difficultyLabel[difficulty]}
${instructions[difficulty]}

Lines to mangle:
${hookLines.map((l, i) => `${i + 1}. ${l}`).join('\n')}

Rules:
- Never use the song title or artist name anywhere
- Mangle each line independently
- Return ONLY a raw JSON array of ${hookLines.length} strings, no markdown, no explanation
- Format: ["mangled line 1", "mangled line 2", "mangled line 3", "mangled line 4"]`
}

const CHAIN_LENGTH = { very_easy: 2, easy: 3, medium: 4, hard: 5, very_hard: 6 }

export function pickChain(difficulty = 'medium') {
  const length = CHAIN_LENGTH[difficulty] ?? 4
  return [...LANGUAGE_POOL].sort(() => Math.random() - 0.5).slice(0, length)
}
