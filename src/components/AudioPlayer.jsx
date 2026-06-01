'use client'
import { motion } from 'framer-motion'
import { useAudio } from '../hooks/useAudio'
import { forwardRef, useImperativeHandle } from 'react'

const NUM_BARS = 32

function WaveformBars({ isPlaying }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '3px',
      height: '48px',
      justifyContent: 'center',
    }}>
      {Array.from({ length: NUM_BARS }, (_, i) => (
        <div
          key={i}
          style={{
            width: '3px',
            height: '32px',
            background: isPlaying ? 'var(--accent-cyan)' : 'var(--border-default)',
            borderRadius: '2px',
            transformOrigin: 'bottom',
            animationName: isPlaying ? 'wave' : 'none',
            animationDuration: `${0.6 + (i % 5) * 0.08}s`,
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            animationDelay: `${i * 0.04}s`,
            transition: 'background 0.4s, box-shadow 0.4s',
            boxShadow: isPlaying ? '0 0 8px rgba(61, 217, 235, 0.7)' : 'none',
          }}
        />
      ))}
    </div>
  )
}

const AudioPlayer = forwardRef(function AudioPlayer(
  { previewUrl, clipDurationMs = 4000, songIndex, totalSongs, onClipEnded, albumArtSrc },
  ref
) {
  const { play, isPlaying, hasPlayed, error } = useAudio()

  useImperativeHandle(ref, () => ({
    playClip: () => play(previewUrl, clipDurationMs, onClipEnded),
  }))

  return (
    <motion.div
      animate={{
        borderColor: isPlaying ? 'rgba(61, 217, 235, 0.45)' : 'var(--border-default)',
        boxShadow: isPlaying ? '0 0 48px rgba(61, 217, 235, 0.1), inset 0 0 60px rgba(61, 217, 235, 0.03)' : '0 0 0px transparent',
      }}
      transition={{ duration: 0.5 }}
      style={{
        position: 'relative',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '16px',
        padding: '28px 24px 24px',
        textAlign: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Blurred album art background wash */}
      {albumArtSrc && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${albumArtSrc})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(28px)',
          opacity: 0.13,
          transform: 'scale(1.15)',
          pointerEvents: 'none',
        }} />
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Album art above waveform, same width as bars */}
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <motion.img
            src={albumArtSrc ?? 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png'}
            alt="Album cover"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            style={{
              width: '189px',
              height: '189px',
              borderRadius: '8px',
              objectFit: 'cover',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            }}
          />
          <WaveformBars isPlaying={isPlaying} />
        </div>

        <div style={{ marginTop: '16px' }}>
          <div style={{
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '12px',
            color: 'var(--text-muted)',
            letterSpacing: '0.2em',
            marginBottom: '6px',
          }}>
            SONG {songIndex + 1} OF {totalSongs}
          </div>

          {isPlaying && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{
                fontFamily: '"Bebas Neue", sans-serif',
                fontSize: '13px',
                color: 'var(--accent-cyan)',
                letterSpacing: '0.15em',
              }}
            >
              ▶ PLAYING
            </motion.div>
          )}

          {!isPlaying && !hasPlayed && (
            <div style={{
              fontFamily: '"DM Sans", sans-serif',
              fontSize: '13px',
              color: 'var(--text-muted)',
            }}>
              {error ?? 'Get ready...'}
            </div>
          )}

          {hasPlayed && !isPlaying && (
            <div style={{
              fontFamily: '"DM Sans", sans-serif',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}>
              Clip ended — guess the song below
            </div>
          )}
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              marginTop: '10px',
              fontFamily: '"DM Sans", sans-serif',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}
          >
            {error}
          </motion.p>
        )}
      </div>
    </motion.div>
  )
})

export default AudioPlayer
