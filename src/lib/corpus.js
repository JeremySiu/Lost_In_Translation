function pickRandom(arr, n) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n)
}

/**
 * Pick 5 songs for a round.
 * - At least 1 trending song
 * - Remaining from non-trending pool
 * - Excludes already-seen IDs
 */
export function pickRound(corpus, seenIds = new Set()) {
  const available = corpus.filter(s => !seenIds.has(s.id))
  const trending = available.filter(s => s.trending)
  const regular = available.filter(s => !s.trending)

  const selected = [
    ...pickRandom(trending, Math.min(1, trending.length)),
    ...pickRandom(regular, Math.max(0, 5 - Math.min(1, trending.length))),
  ].slice(0, 5)

  // If we couldn't get 5, backfill from all available
  if (selected.length < 5) {
    const ids = new Set(selected.map(s => s.id))
    const rest = available.filter(s => !ids.has(s.id))
    selected.push(...pickRandom(rest, 5 - selected.length))
  }

  return selected
}
