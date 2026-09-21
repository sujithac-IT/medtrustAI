import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { CaseSheet } from '../types/index'
import { SUPPORTED_LANGUAGES } from '../i18n/config'

const LANG_SUMMARIES: Record<string, string> = {
  en: 'Mr. K. Sundaram, 58 years old male, presented with chest pain for the past 3 weeks. He has a history of hypertension and type 2 diabetes. Currently on aspirin, atorvastatin and metformin. Advised further cardiac evaluation and follow-up in 2 weeks.',
  ta: 'திரு கே. சுந்தரம், 58 வயது ஆண், கடந்த 3 வாரங்களாக மார்பு வலியுடன் வந்துள்ளார். அவருக்கு உயர் இரத்த அழுத்தம் மற்றும் வகை 2 நீரிழிவு நோய் வரலாறு உள்ளது. தற்போது ஆஸ்பிரின், அடோர்வாஸ்டாடின் மற்றும் மெட்ஃபோர்மின் சாப்பிடுகிறார். மேலும் இதய பரிசோதனை மற்றும் 2 வாரங்களில் மறு சோதனை பரிந்துரைக்கப்பட்டது.',
  hi: 'श्री के. सुंदरम, 58 वर्षीय पुरुष, पिछले 3 हफ्तों से सीने में दर्द के साथ आए। उन्हें उच्च रक्तचाप और टाइप 2 मधुमेह का इतिहास है। वर्तमान में एस्पिरिन, एटोरवास्टेटिन और मेटफॉर्मिन ले रहे हैं। आगे हृदय मूल्यांकन और 2 सप्ताह में अनुवर्ती की सलाह दी गई।',
  te: 'శ్రీ కె. సుందరం, 58 సంవత్సరాల పురుషుడు, గత 3 వారాలుగా ఛాతీ నొప్పితో వచ్చారు. వారికి హైపర్టెన్షన్ మరియు టైప్ 2 మధుమేహ చరిత్ర ఉంది. ప్రస్తుతం ఆస్పిరిన్, అటోర్వాస్టాటిన్ మరియు మెట్‌ఫార్మిన్ తీసుకుంటున్నారు. మరింత గుండె మూల్యాంకనం మరియు 2 వారాల్లో ఫాలో-అప్ సలహా ఇవ్వబడింది.',
  ml: 'ശ്രീ കെ. സുന്ദരം, 58 വയസ്സുള്ള പുരുഷൻ, കഴിഞ്ഞ 3 ആഴ്ചയായി നെഞ്ചുവേദനയുമായി വന്നു. അദ്ദേഹത്തിന് ഹൈപ്പർടെൻഷനും ടൈപ്പ് 2 പ്രമേഹവും ഉണ്ട്. ഇപ്പോൾ ആസ്പിരിൻ, അറ്റോർവാസ്റ്റാറ്റിൻ, മെറ്റ്ഫോർമിൻ എന്നിവ കഴിക്കുന്നു. കൂടുതൽ ഹൃദയ പരിശോധനയും 2 ആഴ്ചയ്ക്കുള്ളിൽ ഫോളോ-അപ്പും നിർദ്ദേശിച്ചു.',
  kn: 'ಶ್ರೀ ಕೆ. ಸುಂದರಂ, 58 ವರ್ಷದ ಪುರುಷ, ಕಳೆದ 3 ವಾರಗಳಿಂದ ಎದೆ ನೋವಿನೊಂದಿಗೆ ಬಂದಿದ್ದಾರೆ. ಅವರಿಗೆ ಅಧಿಕ ರಕ್ತದೊತ್ತಡ ಮತ್ತು ಟೈಪ್ 2 ಮಧುಮೇಹ ಇತಿಹಾಸ ಇದೆ. ಪ್ರಸ್ತುತ ಆಸ್ಪಿರಿನ್, ಅಟೋರ್ವಾಸ್ಟಾಟಿನ್ ಮತ್ತು ಮೆಟ್ಫಾರ್ಮಿನ್ ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದ್ದಾರೆ. ಹೆಚ್ಚಿನ ಹೃದಯ ಮೌಲ್ಯಮಾಪನ ಮತ್ತು 2 ವಾರಗಳಲ್ಲಿ ಫಾಲೋ-ಅಪ್ ಸೂಚಿಸಲಾಗಿದೆ.',
}

const DEFAULT_KEY_POINTS = [
  'Chest pain for 3 weeks (exertional)',
  'Known case of hypertension and type 2 diabetes',
  'On aspirin, atorvastatin and metformin',
  'Advised cardiac evaluation',
]

const VOICE_OPTIONS = [
  { label: 'Google US English', code: 'en-US' },
  { label: 'Google India English', code: 'en-IN' },
]

export default function MultilingualSummaryPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeLang, setActiveLang] = useState('en')
  const [voice, setVoice] = useState('en-US')
  const [speed, setSpeed] = useState(1.0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(72) // 1:12
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [patientName, setPatientName] = useState('K. Sundaram')
  const [summaries, setSummaries] = useState<Record<string, string>>(LANG_SUMMARIES)
  const [keyPoints, setKeyPoints] = useState<string[]>(DEFAULT_KEY_POINTS)

  useEffect(() => {
    const saved = localStorage.getItem('medtrust_case_sheets')
    if (saved) {
      try {
        const list: CaseSheet[] = JSON.parse(saved)
        const latest = list[list.length - 1]
        if (latest) {
          setPatientName(latest.patientName || 'K. Sundaram')
          if (latest.summaries) {
            setSummaries({ ...LANG_SUMMARIES, ...latest.summaries })
          }
        }
      } catch {}
    }
  }, [])

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel()
    setIsPlaying(false)
    setCurrentTime(0)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const togglePlayback = () => {
    if (!('speechSynthesis' in window)) return

    if (isPlaying) {
      stopSpeaking()
      return
    }

    window.speechSynthesis.cancel()
    const text = summaries[activeLang] || LANG_SUMMARIES[activeLang] || summaries.en
    const utter = new SpeechSynthesisUtterance(text)

    const langEntry = SUPPORTED_LANGUAGES.find(l => l.code === activeLang)
    utter.lang = langEntry?.speechCode || voice || 'en-US'
    utter.rate = speed

    const totalEst = Math.max(30, Math.round(text.split(' ').length / (speed * 2.2)))
    setDuration(totalEst)
    setCurrentTime(0)
    setIsPlaying(true)

    timerRef.current = setInterval(() => {
      setCurrentTime(prev => {
        if (prev >= totalEst) {
          stopSpeaking()
          return 0
        }
        return prev + 1
      })
    }, 1000)

    utter.onend = () => stopSpeaking()
    utter.onerror = () => stopSpeaking()
    window.speechSynthesis.speak(utter)
  }

  useEffect(() => {
    return () => stopSpeaking()
  }, [])

  const formatAudioTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  const downloadSummary = () => {
    const text = summaries[activeLang] || summaries.en
    const blob = new Blob([`Apollo MedTrust University Teaching Hospital\nPatient: ${patientName}\nLanguage: ${activeLang.toUpperCase()}\n\n${text}\n\nKey Points:\n${keyPoints.map(k => `• ${k}`).join('\n')}`], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Patient_Summary_${patientName.replace(/\s+/g, '_')}_${activeLang}.txt`
    a.click()
  }

  const currentLangObj = SUPPORTED_LANGUAGES.find(l => l.code === activeLang) || SUPPORTED_LANGUAGES[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      {/* Header Matching Screen 4 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>🌐</span>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
          Multilingual Patient Summary
        </h1>
      </div>

      {/* Main Container Card Matching Screen 4 */}
      <div className="card" style={{ padding: 22 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 16 }}>
          Patient Summary
        </div>

        {/* Language Tabs Row Matching Screen 4 */}
        <div style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 20,
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: 12,
        }}>
          {SUPPORTED_LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => {
                setActiveLang(lang.code)
                stopSpeaking()
              }}
              style={{
                padding: '8px 18px',
                borderRadius: 6,
                border: activeLang === lang.code ? '1px solid #2563EB' : '1px solid var(--color-border)',
                background: activeLang === lang.code ? '#2563EB' : 'rgba(255, 255, 255, 0.04)',
                color: activeLang === lang.code ? 'white' : 'var(--color-text-secondary)',
                fontSize: 13,
                fontWeight: activeLang === lang.code ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {lang.name}
            </button>
          ))}
        </div>

        {/* 2-Column Layout Matching Screen 4 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24, alignItems: 'start' }}>
          {/* Left Column: Summary Text + Audio Player + Key Points */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Summary Text Box */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                Summary ({currentLangObj.name})
              </div>
              <div style={{
                padding: '16px 18px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                fontSize: 13,
                lineHeight: 1.7,
                color: 'var(--color-text-primary)',
              }}>
                {summaries[activeLang] || LANG_SUMMARIES[activeLang]}
              </div>
            </div>

            {/* Audio Player Bar Matching Screen 4 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
            }}>
              {/* Circular Play Button */}
              <button
                onClick={togglePlayback}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: isPlaying ? '#EF4444' : '#2563EB',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
                }}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>

              {/* Progress Slider */}
              <input
                type="range"
                min={0}
                max={duration}
                value={currentTime}
                onChange={e => setCurrentTime(Number(e.target.value))}
                style={{
                  flex: 1,
                  accentColor: 'var(--color-teal)',
                  cursor: 'pointer',
                }}
              />

              {/* Time display: 0:00 / 1:12 */}
              <span style={{
                fontSize: 12,
                color: 'var(--color-text-muted)',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
              }}>
                {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
              </span>

              {/* Volume Icon */}
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  fontSize: 16,
                  cursor: 'pointer',
                }}
              >
                🔊
              </button>
            </div>

            {/* Key Points */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>
                Key Points
              </div>
              <ul style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 13,
                color: 'var(--color-text-secondary)',
                lineHeight: 1.8,
              }}>
                {keyPoints.map((pt, i) => (
                  <li key={i}>{pt}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Column: Voice Settings & Download Summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Voice Settings Card */}
            <div style={{
              padding: 16,
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Voice Settings
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 11 }}>Voice</label>
                <select
                  className="form-select"
                  value={voice}
                  onChange={e => setVoice(e.target.value)}
                  style={{ fontSize: 12 }}
                >
                  {VOICE_OPTIONS.map(v => (
                    <option key={v.code} value={v.code}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label className="form-label" style={{ fontSize: 11, margin: 0 }}>Speed</label>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                    {speed.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.75"
                  max="1.5"
                  step="0.05"
                  value={speed}
                  onChange={e => setSpeed(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--color-teal)', cursor: 'pointer' }}
                />
              </div>
            </div>

            {/* Download Summary Button Matching Screen 4 */}
            <button
              onClick={downloadSummary}
              style={{
                width: '100%',
                padding: '11px 16px',
                background: 'transparent',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s',
              }}
            >
              <span>📥</span>
              Download Summary
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
