const LANGUAGE_POOL = [
  'Mandarin', 'Swahili', 'Finnish', 'Icelandic', 'Mongolian',
  'Yoruba', 'Georgian', 'Basque', 'Tamil', 'Quechua',
  'Latvian', 'Zulu', 'Kazakh', 'Welsh', 'Amharic',
]

/**
 * Compute difficulty tier and clip duration from session performance history.
 * Each entry in performanceHistory: { score, timeToGuessSeconds, hintsUsed, wrongGuesses }
 */
export function computeAdaptiveParams(performanceHistory = [], roundNumber = 1) {
  if (performanceHistory.length === 0) {
    return { difficulty: 'medium', clip_duration_ms: 5000 }
  }

  const scores = performanceHistory.map(p => {
    // Normalize each signal to 0–1 (higher = player performing better = harder next round)
    const maxScore = 500
    const scoreRatio = Math.min(p.score / maxScore, 1)

    // Fast guess (<15s) = 1.0, slow (>60s) = 0.0
    const timeRatio = Math.max(0, Math.min(1, 1 - (p.timeToGuessSeconds - 15) / 45))

    // 0 hints = 1.0, 3+ hints = 0.0
    const hintRatio = Math.max(0, Math.min(1, 1 - p.hintsUsed / 3))

    // 0 wrong = 1.0, 3+ wrong = 0.0
    const wrongRatio = Math.max(0, Math.min(1, 1 - p.wrongGuesses / 3))

    // Weighted average: score 30%, time 30%, hints 20%, wrong 20%
    return scoreRatio * 0.3 + timeRatio * 0.3 + hintRatio * 0.2 + wrongRatio * 0.2
  })

  const performanceRatio = scores.reduce((a, b) => a + b, 0) / scores.length

  let difficulty
  if (performanceRatio >= 0.85) difficulty = 'very_hard'
  else if (performanceRatio >= 0.65) difficulty = 'hard'
  else if (performanceRatio >= 0.40) difficulty = 'medium'
  else if (performanceRatio >= 0.20) difficulty = 'easy'
  else difficulty = 'very_easy'

  // Power curve: struggling players (ratio→0) get ~10s, top players (ratio→1) get ~1s.
  // Exponent 1.5 compresses the high end so hard/very_hard land in the 1–3s range.
  const clip_duration_ms = Math.round(1000 + 9000 * Math.pow(1 - performanceRatio, 1.5))

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
