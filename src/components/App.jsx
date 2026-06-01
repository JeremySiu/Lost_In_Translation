'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameState } from '../hooks/useGameState'
import HomeScreen from './HomeScreen'
import RoundHeader from './RoundHeader'
import AudioPlayer from './AudioPlayer'
import MangledLyricDisplay from './MangledLyricDisplay'
import LanguageChainBar from './LanguageChainBar'
import GuessInput from './GuessInput'
import HintButton from './HintButton'
import RoundSummary from './RoundSummary'
import EndScreen from './EndScreen'

const HINT_COST = 100
const SONGS_PER_ROUND = 5

// Silent 0-sample WAV. Playing this synchronously inside a click handler
// establishes the browser's "sticky media activation" for the page, so that
// audio.play() calls made later (after async API work) are not blocked by
// the autoplay policy.
const SILENCE_SRC = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='

async function fetchRound(seenIds = []) {
  const seen = seenIds.join(',')
  const res = await fetch(`/api/songs/round?seen=${seen}`)
  return res.json()
}

async function fetchMangle(songs, performanceHistory, roundNumber) {
  const payload = {
    songs: songs.map(s => ({ id: s.id })),
    performanceHistory,
    roundNumber,
  }
  const res = await fetch('/api/mangle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

async function fetchReveal(songId) {
  const res = await fetch(`/api/songs/${songId}/reveal`)
  return res.json()
}

export default function App() {
  const { state, dispatch } = useGameState()
  const audioRef = useRef(null)
  const giveUpClicksRef = useRef(0)
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState(null)
  const ttsAudioRef = useRef(null)
  const prevRevealedRef = useRef(0)
  const prevSongIndexRef = useRef(-1)

  const currentSong = state.songs[state.currentSongIndex]
  const currentMangled = currentSong ? state.mangledSongs[currentSong.id] : null
  const mangled = currentMangled?.mangled_lines ?? []

  // Auto-play clip when entering playing phase
  useEffect(() => {
    if (state.phase !== 'playing') return

    // No preview URL — skip audio and go straight to guessing
    if (!currentSong?.preview_url) {
      dispatch({ type: 'CLIP_ENDED' })
      return
    }

    if (!audioRef.current) return

    const t = setTimeout(() => {
      audioRef.current?.playClip()
    }, 600)
    return () => clearTimeout(t)
  }, [state.phase, state.currentSongIndex, currentSong?.preview_url, dispatch])

  const handleStart = useCallback(async () => {
    // Synchronously unlock audio while still inside the click gesture stack,
    // before any await takes us past the browser's autoplay activation window.
    new Audio(SILENCE_SRC).play().catch(() => {})

    setIsStarting(true)
    setStartError(null)
    try {
      const songs = await fetchRound()
      if (!Array.isArray(songs) || !songs.length) {
        throw new Error('Could not load songs. Please try again.')
      }

      const mangleResult = await fetchMangle([songs[0]], [], 1)
      if (!mangleResult?.songs) {
        throw new Error('Could not prepare lyrics. Please try again.')
      }

      const mangledSongs = {}
      mangleResult.songs.forEach(m => { mangledSongs[m.id] = m })

      const firstSongChain = mangledSongs[songs[0].id]?.language_chain ?? []
      const songsWithChain = songs.map((s, i) => ({
        ...s,
        language_chain: i === 0 ? firstSongChain : [],
      }))

      dispatch({
        type: 'START_GAME',
        songs: songsWithChain,
        mangledSongs,
        clipDurationMs: mangleResult.clip_duration_ms ?? 4000,
        difficulty: mangleResult.difficulty ?? 'medium',
      })
    } catch (err) {
      setStartError(err.message ?? 'Something went wrong. Please try again.')
    } finally {
      setIsStarting(false)
    }
  }, [dispatch])

  const handleClipEnded = useCallback(() => {
    dispatch({ type: 'CLIP_ENDED' })
  }, [dispatch])

  const speakLyric = useCallback(async (text) => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause()
      ttsAudioRef.current = null
    }
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      ttsAudioRef.current = audio
      audio.play().catch(() => {})
      audio.addEventListener('ended', () => {
        URL.revokeObjectURL(url)
        if (ttsAudioRef.current === audio) ttsAudioRef.current = null
      })
    } catch {}
  }, [])

  // Speak each lyric line as it is revealed in the guessing phase
  useEffect(() => {
    const { phase, revealedCount, currentSongIndex } = state

    if (currentSongIndex !== prevSongIndexRef.current) {
      prevSongIndexRef.current = currentSongIndex
      prevRevealedRef.current = 0
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause()
        ttsAudioRef.current = null
      }
    }

    if (phase !== 'guessing') return
    if (revealedCount <= prevRevealedRef.current) return

    const newLineIndex = revealedCount - 1
    prevRevealedRef.current = revealedCount

    const text = mangled[newLineIndex]
    if (text) speakLyric(text)
  }, [state.phase, state.revealedCount, state.currentSongIndex, mangled, speakLyric])

  const handleHint = useCallback(() => {
    dispatch({ type: 'REVEAL_HINT' })
  }, [dispatch])

  // Kick off mangle for the next song in background (called after current song resolves)
  const prefetchNextSong = useCallback((updatedPerfHistory) => {
    const nextIndex = state.currentSongIndex + 1
    if (nextIndex >= state.songs.length) return
    const nextSong = state.songs[nextIndex]
    fetchMangle([nextSong], updatedPerfHistory, state.roundNumber)
      .then(result => dispatch({ type: 'MERGE_MANGLE', data: result }))
      .catch(() => {})
  }, [state.currentSongIndex, state.songs, state.roundNumber, dispatch])

  const handleGuess = useCallback((guess) => {
    if (!currentSong) return
    const normalise = s => s.toLowerCase().replace(/[^a-z0-9]/g, '')
    const correct = normalise(currentSong.title)
    const attempt = normalise(guess)

    if (attempt === correct || guess.toLowerCase().includes(currentSong.title.toLowerCase())) {
      dispatch({ type: 'CORRECT_GUESS' })
      fetchReveal(currentSong.id).then(data => dispatch({ type: 'SET_REVEAL_DATA', data }))
      // Build the updated perf history the reducer will produce, so mangle gets accurate data
      const timeToGuessSeconds = state.timerStart ? (Date.now() - state.timerStart) / 1000 : 30
      const basePoints = Math.max(100, 500 - state.hintsUsed * 100)
      const newStreak = Math.min(state.streak + 0.2, 2.0)
      const earned = Math.round(basePoints * newStreak)
      const updatedPerf = [...state.performanceHistory, { score: earned, timeToGuessSeconds, hintsUsed: state.hintsUsed, wrongGuesses: state.wrongGuesses }]
      prefetchNextSong(updatedPerf)
    } else {
      dispatch({ type: 'WRONG_GUESS' })
      setTimeout(() => dispatch({ type: 'CLEAR_GUESS_STATE' }), 500)
    }
  }, [currentSong, state.performanceHistory, state.timerStart, state.hintsUsed, state.streak, state.wrongGuesses, prefetchNextSong])

  const handleGiveUp = useCallback(() => {
    giveUpClicksRef.current += 1
    if (giveUpClicksRef.current < 2) {
      setTimeout(() => { giveUpClicksRef.current = 0 }, 1500)
      return
    }
    giveUpClicksRef.current = 0
    dispatch({ type: 'GIVE_UP' })
    if (currentSong) {
      fetchReveal(currentSong.id).then(data => dispatch({ type: 'SET_REVEAL_DATA', data }))
    }
    const updatedPerf = [...state.performanceHistory, { score: 0, timeToGuessSeconds: 60, hintsUsed: state.hintsUsed, wrongGuesses: state.wrongGuesses }]
    prefetchNextSong(updatedPerf)
  }, [dispatch, currentSong, state.performanceHistory, state.hintsUsed, state.wrongGuesses, prefetchNextSong])

  const handleShowSummary = useCallback(() => {
    dispatch({ type: 'SHOW_SUMMARY' })
  }, [dispatch])

  const handleNextSong = useCallback(() => {
    dispatch({ type: 'NEXT_SONG' })
  }, [dispatch])

  const handleNewGame = useCallback(() => {
    dispatch({ type: 'NEW_GAME' })
  }, [dispatch])

  const maxHints = mangled.length
  const hintsRemaining = Math.max(0, maxHints - state.revealedCount)
  const currentChain = currentMangled?.language_chain ?? currentSong?.language_chain ?? []
  const allSongsForFuse = state.songs

  const screenVariants = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  }

  return (
    <AnimatePresence>
      {state.screen === 'home' && (
        <motion.div key="home" {...screenVariants} transition={{ duration: 0.3 }}>
          <HomeScreen onStart={handleStart} isStarting={isStarting} startError={startError} />
        </motion.div>
      )}

      {state.screen === 'round' && currentSong && (
        <motion.div key={`round-${state.currentSongIndex}`} {...screenVariants} transition={{ duration: 0.3 }}>
          <div className="game-container">
            <RoundHeader
              songIndex={state.currentSongIndex}
              totalSongs={state.songs.length}
              score={state.scoreTotal}
              streak={state.streak}
              songStatuses={state.songStatuses}
            />

            <AudioPlayer
              ref={audioRef}
              previewUrl={currentSong.preview_url}
              clipDurationMs={state.clipDurationMs}
              songIndex={state.currentSongIndex}
              totalSongs={state.songs.length}
              onClipEnded={handleClipEnded}
              albumArtSrc="https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png"
            />

            {state.phase !== 'playing' && mangled.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginTop: '24px' }}
              >
                <MangledLyricDisplay
                  mangledLines={mangled}
                  revealedCount={state.revealedCount}
                />

                <div style={{ marginTop: '12px' }}>
                  <LanguageChainBar chain={currentChain} />
                </div>
              </motion.div>
            )}

            {state.phase === 'guessing' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ marginTop: '24px' }}
              >
                <GuessInput
                  songs={allSongsForFuse}
                  onGuess={handleGuess}
                  disabled={false}
                  guessState={state.guessState}
                />

                <div style={{ marginTop: '12px' }}>
                  <HintButton
                    onClick={handleHint}
                    costPoints={HINT_COST}
                    disabled={hintsRemaining === 0}
                    hintsRemaining={hintsRemaining}
                  />
                </div>

                <div style={{ marginTop: '8px', textAlign: 'center' }}>
                  <button
                    onClick={handleGiveUp}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontFamily: '"DM Sans", sans-serif',
                      fontSize: '13px',
                      cursor: 'pointer',
                      padding: '8px',
                    }}
                  >
                    Give up (click twice)
                  </button>
                </div>
              </motion.div>
            )}

            {state.phase === 'resolved' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                style={{ marginTop: '32px', textAlign: 'center' }}
              >
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  style={{
                    fontFamily: '"Bebas Neue", sans-serif',
                    fontSize: '48px',
                    color: state.guessState === 'correct' ? 'var(--correct)' : 'var(--text-muted)',
                    letterSpacing: '0.06em',
                    lineHeight: 1,
                    marginBottom: '8px',
                    textShadow: state.guessState === 'correct'
                      ? '0 0 40px rgba(34, 197, 94, 0.5)'
                      : 'none',
                  }}
                >
                  {state.guessState === 'correct' ? '✓ CORRECT' : '✗ GIVEN UP'}
                </motion.div>
                {state.lastEarned > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 250 }}
                    style={{
                      fontFamily: '"Bebas Neue", sans-serif',
                      fontSize: '32px',
                      color: 'var(--accent-yellow)',
                      letterSpacing: '0.04em',
                      textShadow: '0 0 30px rgba(232, 255, 71, 0.4)',
                    }}
                  >
                    +{state.lastEarned} pts
                  </motion.div>
                )}
                <motion.button
                  onClick={handleShowSummary}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 }}
                  style={{
                    marginTop: '24px',
                    padding: '14px 32px',
                    background: 'var(--accent-yellow)',
                    color: '#07070d',
                    fontFamily: '"Bebas Neue", sans-serif',
                    fontSize: '18px',
                    letterSpacing: '0.08em',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                  }}
                >
                  See Details →
                </motion.button>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

      {state.screen === 'summary' && (
        <motion.div key={`summary-${state.currentSongIndex}`} {...screenVariants} transition={{ duration: 0.3 }}>
          <RoundSummary
            song={currentSong}
            revealData={state.revealData}
            mangledLines={mangled}
            languageChain={currentChain}
            outcome={state.songStatuses[state.currentSongIndex]}
            earned={state.lastEarned ?? 0}
            scoreTotal={state.scoreTotal}
            isLastSong={state.currentSongIndex >= state.songs.length - 1}
            onNext={handleNextSong}
          />
        </motion.div>
      )}

      {state.screen === 'end' && (
        <motion.div key="end" {...screenVariants} transition={{ duration: 0.3 }}>
          <EndScreen
            scoreTotal={state.scoreTotal}
            songStatuses={state.songStatuses}
            songs={state.songs}
            onPlayAgain={handleNewGame}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
