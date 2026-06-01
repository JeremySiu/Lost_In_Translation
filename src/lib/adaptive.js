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
    return { difficulty: 'medium', clip_duration_ms: 4000 }
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

  // Clip: 5000ms at ratio=0, 1000ms at ratio=1
  const clip_duration_ms = Math.round(Math.max(1000, Math.min(5000, 5000 - performanceRatio * 4000)))

  return { difficulty, clip_duration_ms }
}

export function buildManglePrompt(hookLines, languageChain, difficulty) {
  const instructions = {
    very_easy: `Mild mangling only. Replace words with close synonyms. Keep sentence structure intact. The song should be immediately recognisable.`,
    easy: `Moderate mangling. Replace key words with formal synonyms, keep structure close. The emotional meaning should still be clear after a moment's thought.`,
    medium: `Substantial mangling. Use overly literal or bureaucratic phrasing. Meaning is decipherable but requires real thought.`,
    hard: `Aggressive mangling. Use highly formal, academic, or clinical language. The connection to the original should require genuine effort.`,
    very_hard: `Maximum mangling. The original meaning must be extremely obscure. Use the most indirect, convoluted phrasing possible while technically preserving meaning.`,
  }

  return `You are a language mangling engine for a music guessing game.

Simulate translating these lyrics through: English → ${languageChain.join(' → ')} → English

Difficulty: ${difficulty.toUpperCase()}
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
