'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

function looksLikePlaylistUrl(url) {
  return /playlist[/:][A-Za-z0-9]+/.test(url) || /^[A-Za-z0-9]{16,}$/.test(url.trim())
}

export default function HomeScreen({ onStart, isStarting = false, startError = null }) {
  const [howToOpen, setHowToOpen] = useState(false)
  const [mode, setMode] = useState('top100')
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [urlError, setUrlError] = useState(null)

  const handleStartClick = () => {
    if (isStarting) return
    if (mode === 'playlist') {
      if (!looksLikePlaylistUrl(playlistUrl)) {
        setUrlError('Enter a valid Spotify playlist link.')
        return
      }
      setUrlError(null)
      onStart('playlist', playlistUrl.trim())
    } else {
      onStart('top100')
    }
  }

  const modeButton = (value, title, subtitle) => {
    const active = mode === value
    return (
      <button
        onClick={() => { setMode(value); setUrlError(null) }}
        disabled={isStarting}
        style={{
          flex: 1,
          textAlign: 'left',
          padding: '16px 18px',
          background: active ? 'var(--accent-yellow)' : 'var(--bg-surface)',
          color: active ? '#07070d' : 'var(--text-primary)',
          border: active ? '1px solid var(--accent-yellow)' : '1px solid var(--border-default)',
          borderRadius: '10px',
          cursor: isStarting ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s, color 0.2s, border-color 0.2s',
        }}
      >
        <div style={{
          fontFamily: '"Bebas Neue", sans-serif',
          fontSize: '20px',
          letterSpacing: '0.04em',
          lineHeight: 1.1,
        }}>
          {title}
        </div>
        <div style={{
          fontFamily: '"DM Sans", sans-serif',
          fontSize: '12px',
          marginTop: '4px',
          color: active ? 'rgba(7,7,13,0.7)' : 'var(--text-muted)',
          lineHeight: 1.3,
        }}>
          {subtitle}
        </div>
      </button>
    )
  }

  return (
    <div className="game-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 'calc(100vh - 80px)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div style={{ marginBottom: '36px' }}>
          <h1 style={{
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: 'clamp(52px, 12vw, 80px)',
            lineHeight: 0.9,
            color: 'var(--text-primary)',
            letterSpacing: '0.02em',
          }}>
            LOST IN<br />
            <span style={{ color: 'var(--accent-yellow)' }}>TRANSLATION</span>
          </h1>
          <p style={{
            marginTop: '20px',
            fontFamily: '"DM Sans", sans-serif',
            fontSize: '16px',
            color: 'var(--text-secondary)',
            maxWidth: '400px',
            lineHeight: 1.5,
          }}>
            Famous lyrics. Scrambled beyond recognition.<br />Can you guess the song?
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          {modeButton('top100', 'TOP 100 HITS', 'Play with trending songs')}
          {modeButton('playlist', 'MY PLAYLIST', 'Use a Spotify playlist')}
        </div>

        <AnimatePresence initial={false}>
          {mode === 'playlist' && (
            <motion.div
              key="playlist-input"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden', marginBottom: '16px' }}
            >
              <input
                type="text"
                value={playlistUrl}
                onChange={e => { setPlaylistUrl(e.target.value); setUrlError(null) }}
                onKeyDown={e => { if (e.key === 'Enter') handleStartClick() }}
                disabled={isStarting}
                placeholder="https://open.spotify.com/playlist/..."
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  border: `1px solid ${urlError ? 'var(--incorrect, #ef4444)' : 'var(--border-default)'}`,
                  borderRadius: '10px',
                  fontFamily: '"DM Sans", sans-serif',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              {urlError && (
                <p style={{
                  fontFamily: '"DM Sans", sans-serif',
                  fontSize: '13px',
                  color: 'var(--text-muted)',
                  marginTop: '8px',
                }}>
                  {urlError}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          onClick={handleStartClick}
          whileHover={isStarting ? {} : { scale: 1.03 }}
          whileTap={isStarting ? {} : { scale: 0.97 }}
          disabled={isStarting}
          style={{
            display: 'block',
            width: '100%',
            padding: '18px 32px',
            background: isStarting ? 'var(--bg-surface)' : 'var(--accent-yellow)',
            color: isStarting ? 'var(--text-muted)' : '#07070d',
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '22px',
            letterSpacing: '0.08em',
            border: isStarting ? '1px solid var(--border-default)' : 'none',
            borderRadius: '10px',
            cursor: isStarting ? 'not-allowed' : 'pointer',
            marginBottom: '8px',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          {isStarting
            ? (mode === 'playlist' ? 'FETCHING PLAYLIST...' : 'LOADING...')
            : 'START GAME'}
        </motion.button>

        {startError && (
          <p style={{
            fontFamily: '"DM Sans", sans-serif',
            fontSize: '14px',
            color: 'var(--text-muted)',
            marginBottom: '12px',
            textAlign: 'center',
          }}>
            {startError}
          </p>
        )}

        <button
          onClick={() => setHowToOpen(o => !o)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontFamily: '"DM Sans", sans-serif',
            fontSize: '14px',
            cursor: 'pointer',
            padding: '4px 0',
          }}
        >
          How to play {howToOpen ? '↑' : '↓'}
        </button>

        {howToOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            style={{
              marginTop: '16px',
              padding: '20px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: '5px',
              fontFamily: '"DM Sans", sans-serif',
              fontSize: '14px',
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
            }}
          >
            <p><strong style={{ color: 'var(--text-primary)' }}>1. Listen</strong>: A short clip from a popular song plays.</p>
            <p style={{ marginTop: '8px' }}><strong style={{ color: 'var(--text-primary)' }}>2. Decode</strong>: The lyrics have been translated through bizarre language chains and back to English. They're scrambled, but the meaning is still in there.</p>
            <p style={{ marginTop: '8px' }}><strong style={{ color: 'var(--text-primary)' }}>3. Guess</strong>: Type the song title. Use hints if you're stuck, but each hint costs points.</p>
            <p style={{ marginTop: '8px' }}><strong style={{ color: 'var(--text-primary)' }}>4. Adapt</strong>: The game watches how fast and confidently you answer. It gets harder when you're winning.</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
