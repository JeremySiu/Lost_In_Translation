'use client'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function GuessInput({ songs, onGuess, disabled, guessState }) {
  // guessState: null | 'correct' | 'wrong'
  const [value, setValue] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [shake, setShake] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef(null)

  // Shake on wrong guess
  useEffect(() => {
    if (guessState === 'wrong') {
      setShake(true)
      setTimeout(() => setShake(false), 300)
    }
    if (guessState === 'correct' || guessState === 'wrong') {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [guessState])

  const handleChange = (e) => {
    const val = e.target.value
    setValue(val)
    setHighlightedIndex(-1)

    if (val.length < 2 || !songs?.length) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const lower = val.toLowerCase()
    const results = songs.filter(s => s.title.toLowerCase().includes(lower))
    setSuggestions(results)
    setShowSuggestions(results.length > 0)
  }

  const submitGuess = (text) => {
    const trimmed = text.trim()
    if (!trimmed) return
    onGuess(trimmed)
    setValue('')
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        const s = suggestions[highlightedIndex]
        submitGuess(`${s.title} - ${s.artist}`)
      } else {
        submitGuess(value)
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const borderColor = guessState === 'correct'
    ? 'var(--correct)'
    : guessState === 'wrong'
    ? 'var(--accent-red)'
    : showSuggestions
    ? 'var(--accent-yellow)'
    : 'var(--border-default)'

  return (
    <div style={{ position: 'relative' }}>
      <motion.div
        animate={shake ? { x: [-6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--bg-elevated)',
          border: `1px solid ${borderColor}`,
          borderRadius: '10px',
          height: '52px',
          transition: 'border-color 0.2s',
          overflow: 'hidden',
        }}>
          <span style={{ padding: '0 14px', fontSize: '18px' }}>🎵</span>
          <input
            ref={inputRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Type your answer..."
            disabled={disabled}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontFamily: '"DM Sans", sans-serif',
              fontSize: '16px',
              color: 'var(--text-primary)',
              height: '100%',
            }}
          />
          <button
            onClick={() => submitGuess(value)}
            disabled={!value.trim() || disabled}
            style={{
              padding: '0 18px',
              height: '100%',
              background: 'none',
              border: 'none',
              cursor: value.trim() && !disabled ? 'pointer' : 'not-allowed',
              color: value.trim() && !disabled ? 'var(--accent-yellow)' : 'var(--text-muted)',
              fontSize: '20px',
              transition: 'color 0.2s',
            }}
          >
            →
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: '10px',
              overflow: 'hidden',
              maxHeight: '260px',
              overflowY: 'auto',
              zIndex: 100,
            }}
          >
            {suggestions.map((s, i) => {
              return (
                <button
                  key={s.id}
                  onMouseDown={() => submitGuess(`${s.title} - ${s.artist}`)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '12px 16px',
                    background: i === highlightedIndex ? 'var(--bg-surface)' : 'none',
                    border: 'none',
                    borderBottom: i < suggestions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: '"DM Sans", sans-serif',
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                    transition: 'background 0.1s',
                  }}
                >
                  <span>{s.title}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: '8px', fontSize: '12px' }}>
                    {s.artist}
                  </span>
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
