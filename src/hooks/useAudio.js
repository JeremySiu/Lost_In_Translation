'use client'
import { useRef, useState, useCallback } from 'react'

export function useAudio() {
  const audioRef = useRef(null)
  const timerRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasPlayed, setHasPlayed] = useState(false)
  const [error, setError] = useState(null)

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setIsPlaying(false)
  }, [])

  const play = useCallback((previewUrl, durationMs, onEnded) => {
    stop()
    setError(null)

    const audio = new Audio(previewUrl)
    audioRef.current = audio

    audio.addEventListener('error', () => {
      setIsPlaying(false)
      setError('Audio unavailable — proceeding to lyrics')
      onEnded?.()
    })

    audio.play().then(() => {
      setIsPlaying(true)
      setHasPlayed(true)
      timerRef.current = setTimeout(() => {
        audio.pause()
        audio.currentTime = 0
        setIsPlaying(false)
        onEnded?.()
      }, durationMs)
    }).catch(() => {
      setError('Audio unavailable — proceeding to lyrics')
      setIsPlaying(false)
      onEnded?.()
    })
  }, [stop])

  const reset = useCallback(() => {
    stop()
    setHasPlayed(false)
    setError(null)
  }, [stop])

  return { play, stop, reset, isPlaying, hasPlayed, error }
}
