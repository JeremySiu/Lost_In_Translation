'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'

export default function HomeScreen({ onStart, isStarting = false, startError = null }) {
  const [howToOpen, setHowToOpen] = useState(false)

  return (
    <div className="game-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div style={{ marginBottom: '48px' }}>
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

        <motion.button
          onClick={isStarting ? undefined : onStart}
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
          {isStarting ? 'LOADING...' : 'START GAME'}
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
