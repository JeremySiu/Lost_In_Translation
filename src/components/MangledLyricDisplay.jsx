'use client'
import { motion } from 'framer-motion'

function TeletypeLine({ text }) {
  const chars = text.split('')
  return (
    <motion.p
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.025 } },
      }}
      style={{
        fontFamily: '"Share Tech Mono", monospace',
        fontSize: 'var(--lyric-size)',
        color: 'var(--accent-cyan)',
        lineHeight: 1.6,
        margin: '4px 0',
        wordBreak: 'break-word',
      }}
    >
      {chars.map((char, i) => (
        <motion.span
          key={i}
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { duration: 0 } },
          }}
        >
          {char}
        </motion.span>
      ))}
    </motion.p>
  )
}

const BLOCK_WIDTHS = [160, 220, 180, 200, 130, 240, 150, 190]

function LockedLine({ index }) {
  const w1 = BLOCK_WIDTHS[index % BLOCK_WIDTHS.length]
  const w2 = BLOCK_WIDTHS[(index + 3) % BLOCK_WIDTHS.length] * 0.55
  const delay = index * 0.18

  const blockStyle = (width, extraDelay = 0) => ({
    display: 'inline-block',
    width: `${width}px`,
    maxWidth: '100%',
    height: '14px',
    borderRadius: '3px',
    background: 'linear-gradient(90deg, var(--bg-elevated) 25%, rgba(255,255,255,0.045) 50%, var(--bg-elevated) 75%)',
    backgroundSize: '200% 100%',
    animation: `shimmer 2.8s ease-in-out infinite`,
    animationDelay: `${delay + extraDelay}s`,
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0' }}>
      <div style={blockStyle(w1)} />
      <div style={blockStyle(w2, 0.25)} />
    </div>
  )
}

export default function MangledLyricDisplay({ mangledLines = [], revealedCount = 0 }) {
  const total = mangledLines.length

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderLeft: '3px solid var(--accent-cyan)',
      borderRadius: '12px',
      padding: '24px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '20px',
        paddingBottom: '14px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <span style={{ width: '20px', height: '1px', background: 'var(--accent-cyan)', flexShrink: 0 }} />
        <span style={{
          fontFamily: '"Bebas Neue", sans-serif',
          fontSize: '11px',
          color: 'var(--accent-cyan)',
          letterSpacing: '0.25em',
          whiteSpace: 'nowrap',
        }}>
          INTERCEPTED TRANSMISSION
        </span>
        <span style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
      </div>

      <div>
        {mangledLines.map((line, i) =>
          i < revealedCount ? (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <TeletypeLine text={line} />
            </motion.div>
          ) : (
            <LockedLine key={i} index={i} />
          )
        )}
      </div>

      {revealedCount < total && (
        <p style={{
          marginTop: '16px',
          fontFamily: '"DM Sans", sans-serif',
          fontSize: '12px',
          color: 'var(--text-muted)',
        }}>
          {total - revealedCount} more hint{total - revealedCount !== 1 ? 's' : ''} available
        </p>
      )}
    </div>
  )
}
