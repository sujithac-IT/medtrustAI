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

/** Shown when the browser has the speech API but its recognition service is blocked or removed. */
export const SPEECH_BLOCKED_MSG =
  "Live captions aren't available in this browser: it blocks the speech recognition service " +
  '(Brave, Chromium and some privacy browsers do this). Open this page in Google Chrome or Microsoft Edge ' +
  'to transcribe. The video call and typed notes still work here.'

// Brave keeps the Web Speech API but disables Google's backend, so every attempt fails with "network".
const isBrave = !!(navigator as Navigator & { brave?: unknown }).brave
// A real outage gets a few attempts; a blocking browser is recognised after the first failure.
const MAX_NETWORK_FAILURES = isBrave ? 1 : 3

export function useSpeech(opts: { enabled: boolean; lang: string; onInterim: (t: string) => void; onFinal: (t: string) => void }) {
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<SR | null>(null)
  const want = useRef(false)
  const failures = useRef(0)
  const retryTimer = useRef<number | undefined>(undefined)
  const cbs = useRef(opts)
  cbs.current = opts

  const stop = useCallback(() => {
    want.current = false
    window.clearTimeout(retryTimer.current)
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
    failures.current = 0
    let heard = false // any result this session proves the service is reachable
    const r = new Ctor()
    r.lang = cbs.current.lang
    r.continuous = true
    r.interimResults = true
    r.maxAlternatives = 1
    r.onresult = (e) => {
      if (failures.current) setError(null) // recovered from a transient outage
      failures.current = 0
      heard = true
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
      if (e.error === 'not-allowed') {
        setError('Microphone permission for speech recognition was denied. Allow the microphone in the address bar, then turn captions off and on.')
        want.current = false
      } else if (e.error === 'service-not-allowed') {
        setError(SPEECH_BLOCKED_MSG)
        want.current = false
      } else if (e.error === 'audio-capture') {
        setError('No microphone is available for live transcription.')
        want.current = false
      } else if (e.error === 'network') {
        failures.current++
        if (!heard && failures.current >= MAX_NETWORK_FAILURES) {
          // Never reached the service: retrying will not help, so stop and say what will.
          setError(SPEECH_BLOCKED_MSG)
          want.current = false
        } else {
          setError(`The speech recognition service can't be reached. Retrying (attempt ${failures.current + 1})...`)
        }
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') setError(`Speech recognition: ${e.error}`)
    }
    // Chrome ends sessions after silence / ~60s; restart while wanted
    r.onend = () => {
      if (!want.current) { setActive(false); return }
      // Back off after repeated failures instead of spinning the CPU on a dead connection.
      const delay = failures.current ? Math.min(30000, 1000 * 2 ** Math.min(failures.current, 5)) : 0
      window.clearTimeout(retryTimer.current)
      retryTimer.current = window.setTimeout(() => {
        if (!want.current) return
        try { r.start() } catch { /* already started */ }
      }, delay)
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
