import { useEffect, useRef } from 'react'

/** Live audio level bars from a MediaStream via WebAudio AnalyserNode. */
export default function AudioWaveform({ stream, bars = 5, color = '#E8833A', height = 18, onLevel }: {
  stream: MediaStream | null; bars?: number; color?: string; height?: number; onLevel?: (level: number) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const levelCb = useRef(onLevel)
  levelCb.current = onLevel

  useEffect(() => {
    const track = stream?.getAudioTracks()[0]
    if (!stream || !track || !canvas.current) return
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AC()
    const src = ctx.createMediaStreamSource(new MediaStream([track]))
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.75
    src.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    const c = canvas.current
    const g = c.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    const w = bars * 6
    c.width = w * dpr
    c.height = height * dpr
    c.style.width = `${w}px`
    c.style.height = `${height}px`
    g.scale(dpr, dpr)
    let raf = 0
    let lastReport = 0
    const draw = (t: number) => {
      analyser.getByteFrequencyData(data)
      g.clearRect(0, 0, w, height)
      const step = Math.floor(data.length / 2 / bars)
      let total = 0
      for (let i = 0; i < bars; i++) {
        let sum = 0
        for (let j = 0; j < step; j++) sum += data[i * step + j]
        const v = sum / step / 255
        total += v
        const bh = Math.max(3, v * height * 1.6)
        g.fillStyle = track.enabled ? color : '#6b7f82'
        g.beginPath()
        g.roundRect(i * 6 + 1, (height - Math.min(bh, height)) / 2, 4, Math.min(bh, height), 2)
        g.fill()
      }
      if (t - lastReport > 200) {
        levelCb.current?.(track.enabled ? total / bars : 0)
        lastReport = t
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      src.disconnect()
      void ctx.close()
    }
  }, [stream, bars, color, height])

  return <canvas ref={canvas} aria-hidden="true" />
}
