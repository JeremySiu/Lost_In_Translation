'use client'
import { AnimatePresence, motion } from 'framer-motion'

export default function RoundHeader({ songIndex, totalSongs, score, streak, songStatuses }) {
  // songStatuses: array of 'pending' | 'correct' | 'wrong' | 'skipped'
  const dots = Array.from({ length: totalSongs }, (_, i) => songStatuses?.[i] ?? 'pending')

  const dotColors = {
    pending: 'var(--border-default)',
    correct: 'var(--correct)',
    wrong: 'var(--wrong)',
    skipped: 'var(--text-muted)',
    current: 'var(--accent-yellow)',
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid var(--border-subtle)',
      marginBottom: '32px',
    }}>
      <span style={{
        fontFamily: '"Bebas Neue", sans-serif',
        fontSize: '14px',
        color: 'var(--text-muted)',
        letterSpacing: '0.12em',
      }}>
        {songIndex + 1} / {totalSongs}
      </span>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {dots.map((status, i) => {
          const isCurrent = i === songIndex && status === 'pending'
          return (
            <div
              key={i}
              style={{
                width: isCurrent ? '10px' : '8px',
                height: isCurrent ? '10px' : '8px',
                borderRadius: '50%',
                background: isCurrent ? dotColors.current : dotColors[status],
                transition: 'background 0.3s, width 0.3s, height 0.3s',
              }}
            />
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{
          fontFamily: '"Bebas Neue", sans-serif',
          fontSize: '30px',
          color: 'var(--accent-yellow)',
          letterSpacing: '0.04em',
          lineHeight: 1,
        }}>
          {score.toLocaleString()}
        </span>
        <AnimatePresence>
          {streak > 1 && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              style={{
                fontFamily: '"DM Sans", sans-serif',
                fontSize: '12px',
                color: '#07070d',
                background: 'var(--accent-yellow)',
                padding: '2px 8px',
                borderRadius: '999px',
                fontWeight: 600,
              }}
            >
              🔥 ×{streak.toFixed(0)}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
