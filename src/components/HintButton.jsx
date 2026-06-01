'use client'
import { motion } from 'framer-motion'

export default function HintButton({ onClick, costPoints, disabled, hintsRemaining }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { borderColor: 'rgba(232, 255, 71, 0.35)', backgroundColor: 'rgba(232, 255, 71, 0.04)' } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      style={{
        width: '100%',
        padding: '13px 18px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderLeft: disabled ? '3px solid var(--border-default)' : '3px solid rgba(232, 255, 71, 0.4)',
        borderRadius: '10px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        transition: 'border-color 0.2s, background-color 0.2s',
      }}
    >
      <span style={{
        fontFamily: '"DM Sans", sans-serif',
        fontSize: '14px',
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{ fontSize: '15px' }}>💡</span>
        Reveal next hint
        {hintsRemaining !== undefined && (
          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            ({hintsRemaining} left)
          </span>
        )}
      </span>
      <span style={{
        fontFamily: '"Bebas Neue", sans-serif',
        fontSize: '15px',
        color: 'var(--accent-red)',
        letterSpacing: '0.05em',
      }}>
        −{costPoints} pts
      </span>
    </motion.button>
  )
}
