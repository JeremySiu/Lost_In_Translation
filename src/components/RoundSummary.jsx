'use client'
import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import LanguageChainBar from './LanguageChainBar'

export default function RoundSummary({
  song,
  revealData,
  mangledLines,
  languageChain,
  outcome,
  earned,
  scoreTotal,
  isLastSong,
  onNext,
}) {
  const isCorrect = outcome === 'correct'
  const audioRef = useRef(null)

  const albumArt = revealData?.album_art_url ?? null
  const previewUrl = revealData?.preview_url ?? song?.preview_url ?? null

  // Auto-play full 30s clip when summary loads
  useEffect(() => {
    if (!previewUrl) return
    const audio = new Audio(previewUrl)
    audioRef.current = audio
    const t = setTimeout(() => { audio.play().catch(() => {}) }, 500)
    return () => {
      clearTimeout(t)
      audio.pause()
    }
  }, [previewUrl])

  return (
    <div className="game-container">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Outcome */}
        <div style={{
          textAlign: 'center',
          marginBottom: '32px',
          paddingTop: '32px',
        }}>
          <div style={{
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '48px',
            letterSpacing: '0.05em',
            color: isCorrect ? 'var(--correct)' : 'var(--text-muted)',
            lineHeight: 1,
          }}>
            {isCorrect ? '✓ CORRECT' : '✗ GIVEN UP'}
          </div>

          {song && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{ marginTop: '16px' }}
            >
              {/* Album art reveal */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 180 }}
                style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}
              >
                <img
                  src={albumArt ?? 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png'}
                  alt={`${song.title} album cover`}
                  style={{
                    width: '180px',
                    height: '180px',
                    borderRadius: '12px',
                    objectFit: 'cover',
                    border: '1px solid var(--border-default)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  }}
                />
              </motion.div>

              <div style={{
                fontFamily: '"Bebas Neue", sans-serif',
                fontSize: '28px',
                color: 'var(--text-primary)',
                letterSpacing: '0.03em',
              }}>
                {song.title}
              </div>
              <div style={{
                fontFamily: '"DM Sans", sans-serif',
                fontSize: '16px',
                color: 'var(--text-secondary)',
                marginTop: '4px',
              }}>
                {song.artist}
              </div>
            </motion.div>
          )}

          {earned > 0 && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
              style={{
                marginTop: '16px',
                fontFamily: '"Bebas Neue", sans-serif',
                fontSize: '32px',
                color: 'var(--accent-yellow)',
              }}
            >
              +{earned} pts
            </motion.div>
          )}
        </div>

        {/* Translation chain section */}
        {revealData && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
            }}
          >
            <div style={{
              fontFamily: '"Bebas Neue", sans-serif',
              fontSize: '11px',
              color: 'var(--text-muted)',
              letterSpacing: '0.2em',
              marginBottom: '16px',
            }}>
              THE ORIGINAL
            </div>

            {revealData.hook_lines?.slice(0, 2).map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.15 }}
                style={{ marginBottom: '12px' }}
              >
                <p style={{
                  fontFamily: '"Share Tech Mono", monospace',
                  fontSize: '15px',
                  color: 'var(--text-primary)',
                  lineHeight: 1.5,
                  marginBottom: '6px',
                }}>
                  "{line}"
                </p>
                {mangledLines[i] && (
                  <p style={{
                    fontFamily: '"Share Tech Mono", monospace',
                    fontSize: '13px',
                    color: 'var(--accent-cyan)',
                    lineHeight: 1.5,
                    paddingLeft: '12px',
                    borderLeft: '2px solid var(--border-default)',
                  }}>
                    → "{mangledLines[i]}"
                  </p>
                )}
              </motion.div>
            ))}

            <div style={{ marginTop: '16px' }}>
              <LanguageChainBar chain={languageChain ?? []} />
            </div>
          </motion.div>
        )}

        {/* Total score */}
        <div style={{
          textAlign: 'center',
          marginBottom: '32px',
          fontFamily: '"DM Sans", sans-serif',
          fontSize: '14px',
          color: 'var(--text-muted)',
        }}>
          Total score:{' '}
          <span style={{ color: 'var(--accent-yellow)', fontFamily: '"Bebas Neue", sans-serif', fontSize: '20px' }}>
            {scoreTotal.toLocaleString()}
          </span>
        </div>

        {/* Next button */}
        <motion.button
          onClick={onNext}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            display: 'block',
            width: '100%',
            padding: '18px 32px',
            background: 'var(--accent-yellow)',
            color: '#07070d',
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '20px',
            letterSpacing: '0.08em',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
          }}
        >
          {isLastSong ? 'SEE RESULTS →' : 'NEXT SONG →'}
        </motion.button>
      </motion.div>
    </div>
  )
}
