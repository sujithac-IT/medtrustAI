import React, { useEffect, useRef, useState } from 'react'

interface AudioWaveformProps {
  isActive: boolean
  color?: string
  barCount?: number
  height?: number
}

export default function AudioWaveform({ isActive, color = '#00D4AA', barCount = 32, height = 48 }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number | undefined>(undefined)
  const barsRef = useRef<number[]>(Array(barCount).fill(0))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const animate = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = height
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const barWidth = (canvas.width / barCount) * 0.6
      const gap = canvas.width / barCount

      barsRef.current = barsRef.current.map((prev, i) => {
        if (!isActive) {
          return prev * 0.85 // decay
        }
        // Simulate audio levels
        const target = Math.random() * 0.8 + 0.1 + Math.sin(Date.now() / 200 + i * 0.5) * 0.15
        return prev * 0.7 + target * 0.3
      })

      barsRef.current.forEach((level, i) => {
        const barH = level * height * 0.9
        const x = i * gap + gap / 2 - barWidth / 2
        const y = (height - barH) / 2

        const gradient = ctx.createLinearGradient(0, y, 0, y + barH)
        if (isActive) {
          // Multi-color neon spectrum across the visualizer width
          const hueRatio = i / barCount
          if (hueRatio < 0.33) {
            gradient.addColorStop(0, '#00E5FF') // Neon Cyan
            gradient.addColorStop(0.6, '#00D4AA') // Teal
            gradient.addColorStop(1, '#059669') // Emerald
          } else if (hueRatio < 0.66) {
            gradient.addColorStop(0, '#A855F7') // Bright Purple
            gradient.addColorStop(0.5, '#6366F1') // Indigo
            gradient.addColorStop(1, '#3B82F6') // Blue
          } else {
            gradient.addColorStop(0, '#EC4899') // Pink
            gradient.addColorStop(0.5, '#8B5CF6') // Violet
            gradient.addColorStop(1, '#00D4AA') // Cyan
          }
        } else {
          gradient.addColorStop(0, '#334155')
          gradient.addColorStop(1, '#1e293b')
        }

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.roundRect(x, y, barWidth, Math.max(barH, 3), barWidth / 2)
        ctx.fill()
      })

      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [isActive, color, barCount, height])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: `${height}px`, borderRadius: 8 }}
    />
  )
}
