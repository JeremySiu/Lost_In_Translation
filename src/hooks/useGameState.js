'use client'
import { useReducer, useCallback } from 'react'

const HINT_COST = 100
const MAX_SCORE_PER_SONG = 500
const SONGS_PER_ROUND = 5

const initialState = {
  screen: 'home',           // 'home' | 'round' | 'summary' | 'end'
  songs: [],                // current round songs (without hook_lines)
  currentSongIndex: 0,
  phase: 'playing',         // 'playing' | 'guessing' | 'resolved'

  // Mangled data from /api/mangle (indexed by song id)
  mangledSongs: {},         // { [songId]: { mangled_lines, ... } }
  difficulty: 'medium',

  revealedCount: 1,         // how many lyric lines are showing (starts at 1)
  hintsUsed: 0,
  wrongGuesses: 0,
  guessState: null,         // null | 'correct' | 'wrong'

  timerStart: null,         // Date.now() when guessing phase starts

  // Per-song outcomes for the current round
  songStatuses: [],         // array of 'pending' | 'correct' | 'wrong' | 'skipped'

  scoreTotal: 0,
  streak: 1.0,              // multiplier: 1.0 base, +0.2 per correct, reset on wrong/skip

  // Session performance history — sent to /api/mangle for adaptive difficulty
  performanceHistory: [],   // [{ score, timeToGuessSeconds, hintsUsed, wrongGuesses }]

  // Reveal data from /api/songs/:id/reveal
  revealData: null,         // { hook_lines, language_chain }

  roundNumber: 1,
  seenIds: [],              // all song ids played this session
}

function reducer(state, action) {
  switch (action.type) {

    case 'START_GAME': {
      return {
        ...initialState,
        screen: 'round',
        songs: action.songs,
        mangledSongs: action.mangledSongs,
        difficulty: action.difficulty,
        revealedCount: 1,
        songStatuses: Array(action.songs.length).fill('pending'),
        seenIds: action.songs.map(s => s.id),
      }
    }

    case 'CLIP_ENDED': {
      return {
        ...state,
        phase: 'guessing',
        timerStart: Date.now(),
        revealedCount: 1,
      }
    }

    case 'REVEAL_HINT': {
      const { mangledSongs, songs, currentSongIndex, revealedCount } = state
      const song = songs[currentSongIndex]
      const mangled = mangledSongs[song?.id]
      const maxLines = mangled?.mangled_lines?.length ?? 4

      if (revealedCount >= maxLines) return state

      const newRevealed = revealedCount + 1
      const costDeducted = revealedCount // first reveal is free (index 0→1 was auto), subsequent cost HINT_COST each

      return {
        ...state,
        revealedCount: newRevealed,
        hintsUsed: state.hintsUsed + 1,
        scoreTotal: Math.max(0, state.scoreTotal - HINT_COST),
      }
    }

    case 'WRONG_GUESS': {
      return {
        ...state,
        guessState: 'wrong',
        wrongGuesses: state.wrongGuesses + 1,
      }
    }

    case 'CLEAR_GUESS_STATE': {
      return { ...state, guessState: null }
    }

    case 'CORRECT_GUESS': {
      const timeToGuessSeconds = state.timerStart
        ? (Date.now() - state.timerStart) / 1000
        : 30

      // Base points: 500 minus 100 per hint used (minimum 100)
      const basePoints = Math.max(100, MAX_SCORE_PER_SONG - state.hintsUsed * HINT_COST)
      const newStreak = Math.min(state.streak + 0.2, 2.0)
      const earned = Math.round(basePoints * newStreak)

      const newSongStatuses = [...state.songStatuses]
      newSongStatuses[state.currentSongIndex] = 'correct'

      const perfEntry = {
        score: earned,
        timeToGuessSeconds,
        hintsUsed: state.hintsUsed,
        wrongGuesses: state.wrongGuesses,
      }

      return {
        ...state,
        guessState: 'correct',
        phase: 'resolved',
        scoreTotal: state.scoreTotal + earned,
        streak: newStreak,
        songStatuses: newSongStatuses,
        performanceHistory: [...state.performanceHistory, perfEntry],
        lastEarned: earned,
      }
    }

    case 'GIVE_UP': {
      const timeToGuessSeconds = state.timerStart
        ? (Date.now() - state.timerStart) / 1000
        : 60

      const newSongStatuses = [...state.songStatuses]
      newSongStatuses[state.currentSongIndex] = 'skipped'

      const perfEntry = {
        score: 0,
        timeToGuessSeconds,
        hintsUsed: state.hintsUsed,
        wrongGuesses: state.wrongGuesses,
      }

      return {
        ...state,
        phase: 'resolved',
        streak: 1.0, // reset streak on give-up
        songStatuses: newSongStatuses,
        performanceHistory: [...state.performanceHistory, perfEntry],
        lastEarned: 0,
      }
    }

    case 'SET_REVEAL_DATA': {
      return { ...state, revealData: action.data }
    }

    case 'MERGE_MANGLE': {
      const merged = { ...state.mangledSongs }
      action.data.songs?.forEach(m => { merged[m.id] = m })
      return {
        ...state,
        mangledSongs: merged,
        difficulty: action.data.difficulty ?? state.difficulty,
      }
    }

    case 'SHOW_SUMMARY': {
      return { ...state, screen: 'summary' }
    }

    case 'NEXT_SONG': {
      const nextIndex = state.currentSongIndex + 1
      if (nextIndex >= state.songs.length) {
        return {
          ...state,
          screen: 'end',
          currentSongIndex: nextIndex,
        }
      }
      return {
        ...state,
        screen: 'round',
        currentSongIndex: nextIndex,
        phase: 'playing',
        revealedCount: 1,
        hintsUsed: 0,
        wrongGuesses: 0,
        guessState: null,
        timerStart: null,
        revealData: null,
      }
    }

    case 'NEW_GAME': {
      return { ...initialState }
    }

    default:
      return state
  }
}

export function useGameState() {
  const [state, dispatch] = useReducer(reducer, initialState)
  return { state, dispatch }
}
