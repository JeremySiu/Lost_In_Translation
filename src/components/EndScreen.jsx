'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

function ScoreRow({ rank, entry, isPlayer }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 16px',
      borderBottom: '1px solid var(--border-subtle)',
      background: isPlayer ? 'var(--bg-elevated)' : 'none',
      borderLeft: isPlayer ? '3px solid var(--accent-yellow)' : '3px solid transparent',
    }}>
      <span style={{
        fontFamily: '"Bebas Neue", sans-serif',
        fontSize: '18px',
        color: rank <= 3 || isPlayer ? 'var(--accent-yellow)' : 'var(--text-muted)',
        width: '32px',
      }}>
        {rank}
      </span>
      <span style={{
        fontFamily: '"Share Tech Mono", monospace',
        fontSize: '16px',
        color: isPlayer ? 'var(--accent-yellow)' : 'var(--text-primary)',
        flex: 1,
        paddingLeft: '12px',
      }}>
        {entry.initials}
        {isPlayer && <span style={{ fontSize: '11px', marginLeft: '8px', color: 'var(--text-muted)', fontFamily: '"DM Sans", sans-serif' }}>YOU</span>}
      </span>
      <span style={{
        fontFamily: '"Bebas Neue", sans-serif',
        fontSize: '20px',
        color: 'var(--accent-yellow)',
      }}>
        {Number(entry.score).toLocaleString()}
      </span>
    </div>
  )
}

export default function EndScreen({ scoreTotal, songStatuses, songs, onPlayAgain }) {
  const [leaderboard, setLeaderboard] = useState([])
  const [initials, setInitials] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submittedInitials, setSubmittedInitials] = useState(null)
  const [playerRank, setPlayerRank] = useState(null)
  const [loadingBoard, setLoadingBoard] = useState(true)

  const fetchLeaderboard = (score) =>
    fetch(`/api/leaderboard?score=${score}`)
      .then(r => r.json())
      .then(data => {
        const entries = Array.isArray(data.entries) ? data.entries : []
        setLeaderboard(entries)
        setPlayerRank(data.playerRank ?? null)
        setLoadingBoard(false)
      })
      .catch(() => setLoadingBoard(false))

  useEffect(() => { fetchLeaderboard(scoreTotal) }, [scoreTotal])

  const handleSubmitScore = async () => {
    const clean = initials.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2)
    if (clean.length === 0) return

    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initials: clean, score: scoreTotal }),
    })

    if (!res.ok) return

    setSubmitted(true)
    setSubmittedInitials(clean)
    fetchLeaderboard(scoreTotal)
  }

  const correctCount = songStatuses.filter(s => s === 'correct').length

  return (
    <div className="game-container" style={{ paddingTop: '48px', paddingBottom: '48px' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Game Over header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: 'clamp(48px, 10vw, 72px)',
            color: 'var(--text-primary)',
            lineHeight: 0.9,
            letterSpacing: '0.03em',
          }}>
            GAME OVER
          </h1>
          <div style={{
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: 'clamp(32px, 8vw, 48px)',
            color: 'var(--accent-yellow)',
            marginTop: '8px',
          }}>
            {scoreTotal.toLocaleString()} PTS
          </div>
          <div style={{
            fontFamily: '"DM Sans", sans-serif',
            fontSize: '14px',
            color: 'var(--text-secondary)',
            marginTop: '8px',
          }}>
            {correctCount}/{songStatuses.length} correct
          </div>
        </div>

        {/* Submit score */}
        {!submitted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--accent-yellow)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
              textAlign: 'center',
            }}
          >
            <div style={{
              fontFamily: '"Bebas Neue", sans-serif',
              fontSize: '18px',
              color: 'var(--accent-yellow)',
              marginBottom: '12px',
            }}>
              ENTER YOUR INITIALS
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <input
                value={initials}
                onChange={e => setInitials(e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
                placeholder="AA"
                style={{
                  width: '80px',
                  padding: '12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontFamily: '"Share Tech Mono", monospace',
                  fontSize: '20px',
                  textAlign: 'center',
                  outline: 'none',
                  textTransform: 'uppercase',
                }}
              />
              <button
                onClick={handleSubmitScore}
                disabled={initials.replace(/[^A-Za-z]/g, '').length === 0}
                style={{
                  padding: '12px 24px',
                  background: 'var(--accent-yellow)',
                  color: '#07070d',
                  border: 'none',
                  borderRadius: '8px',
                  fontFamily: '"Bebas Neue", sans-serif',
                  fontSize: '16px',
                  cursor: 'pointer',
                  letterSpacing: '0.08em',
                }}
              >
                SUBMIT
              </button>
            </div>
          </motion.div>
        )}

        {submitted && (
          <div style={{
            textAlign: 'center',
            marginBottom: '24px',
            fontFamily: '"DM Sans", sans-serif',
            fontSize: '14px',
            color: 'var(--correct)',
          }}>
            ✓ Score submitted!
          </div>
        )}

        {/* Leaderboard */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '12px',
          overflow: 'hidden',
          marginBottom: '32px',
        }}>
          <div style={{
            padding: '16px',
            borderBottom: '1px solid var(--border-default)',
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '14px',
            color: 'var(--text-muted)',
            letterSpacing: '0.15em',
          }}>
            GLOBAL LEADERBOARD
          </div>
          {loadingBoard ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: '"DM Sans", sans-serif', fontSize: '14px' }}>
              Loading...
            </div>
          ) : leaderboard.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: '"DM Sans", sans-serif', fontSize: '14px' }}>
              No scores yet — be the first!
            </div>
          ) : (
            <>
              {leaderboard.map((entry, i) => (
                <ScoreRow
                  key={i}
                  rank={i + 1}
                  entry={entry}
                  isPlayer={submittedInitials !== null && entry.initials === submittedInitials && Number(entry.score) === scoreTotal}
                />
              ))}
              {playerRank !== null && playerRank > 10 && (
                <>
                  <div style={{
                    padding: '6px 16px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontFamily: '"Share Tech Mono", monospace',
                    fontSize: '12px',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    · · ·
                  </div>
                  <ScoreRow
                    rank={playerRank}
                    entry={{ initials: submittedInitials ?? '--', score: scoreTotal }}
                    isPlayer={true}
                  />
                </>
              )}
            </>
          )}
        </div>

        {/* Play again */}
        <motion.button
          onClick={onPlayAgain}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            display: 'block',
            width: '100%',
            padding: '18px',
            background: 'var(--accent-yellow)',
            color: '#07070d',
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '22px',
            letterSpacing: '0.08em',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
          }}
        >
          PLAY AGAIN
        </motion.button>
      </motion.div>
    </div>
  )
}
