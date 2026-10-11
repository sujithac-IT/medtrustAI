import { useCallback, useEffect, useRef, useState } from 'react'

export function useLocalMedia() {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [audioOn, setAudioOn] = useState(true)
  const [videoOn, setVideoOn] = useState(true)
  const ref = useRef<MediaStream | null>(null)

  const acquire = useCallback(async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access requires HTTPS (or localhost) and a modern browser.')
      return
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      })
      ref.current = s
      setStream(s)
    } catch (e) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        ref.current = s
        setStream(s)
        setVideoOn(false)
        setError('Camera unavailable - joined with audio only.')
      } catch {
        setError(e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Camera and microphone permission was denied. Allow access in the browser address bar.'
          : 'No camera or microphone found.')
      }
    }
  }, [])

  useEffect(() => {
    void acquire()
    return () => ref.current?.getTracks().forEach((t) => t.stop())
  }, [acquire])

  const toggleAudio = () => {
    const next = !audioOn
    ref.current?.getAudioTracks().forEach((t) => (t.enabled = next))
    setAudioOn(next)
    return next
  }
  const toggleVideo = () => {
    const next = !videoOn
    ref.current?.getVideoTracks().forEach((t) => (t.enabled = next))
    setVideoOn(next)
    return next
  }
  const release = () => ref.current?.getTracks().forEach((t) => t.stop())

  return { stream, error, audioOn, videoOn, toggleAudio, toggleVideo, retry: acquire, release }
}
