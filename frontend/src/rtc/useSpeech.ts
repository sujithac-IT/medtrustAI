/** Browser speech recognition of the LOCAL microphone only (exact speaker attribution). */
import { useCallback, useEffect, useRef, useState } from 'react'

interface SRResult { isFinal: boolean; 0: { transcript: string; confidence: number } }
interface SREvent { resultIndex: number; results: ArrayLike<SRResult> }
interface SR {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number
  start(): void; stop(): void; abort(): void
  onresult: ((e: SREvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

const Ctor: (new () => SR) | undefined =
  (window as unknown as { SpeechRecognition?: new () => SR }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition

export const speechSupported = !!Ctor

export const SPEECH_LANGS = [
  { code: 'en-IN', label: 'English (India)' },
  { code: 'ta-IN', label: 'Tamil' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'ml-IN', label: 'Malayalam' },
  { code: 'kn-IN', label: 'Kannada' },
]

export function useSpeech(opts: { enabled: boolean; lang: string; onInterim: (t: string) => void; onFinal: (t: string) => void }) {
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<SR | null>(null)
  const want = useRef(false)
  const cbs = useRef(opts)
  cbs.current = opts

  const stop = useCallback(() => {
    want.current = false
    rec.current?.abort()
    rec.current = null
    setActive(false)
  }, [])

  const start = useCallback(() => {
    if (!Ctor) {
      setError('Live speech recognition is not supported in this browser. Use Chrome or Edge, or type notes below.')
      return
    }
    want.current = true
    const r = new Ctor()
    r.lang = cbs.current.lang
    r.continuous = true
    r.interimResults = true
    r.maxAlternatives = 1
    r.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        const text = res[0].transcript.trim()
        if (!text) continue
        if (res.isFinal) cbs.current.onFinal(text)
        else interim += text + ' '
      }
      cbs.current.onInterim(interim.trim())
    }
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Microphone permission for speech recognition was denied.')
        want.current = false
      } else if (e.error === 'audio-capture') {
        setError('No microphone is available for live transcription.')
        want.current = false
      } else if (e.error === 'network') {
        setError('Speech recognition service is unreachable (browser speech needs internet access). Notes can still be typed.')
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') setError(`Speech recognition: ${e.error}`)
    }
    // Chrome ends sessions after silence / ~60s; restart while wanted
    r.onend = () => {
      if (want.current) {
        try { r.start() } catch { /* already started */ }
      } else setActive(false)
    }
    try {
      r.start()
      rec.current = r
      setActive(true)
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }, [])

  useEffect(() => {
    if (opts.enabled) start()
    else stop()
    return stop
  }, [opts.enabled, opts.lang, start, stop])

  return { active, error, supported: speechSupported }
}
