import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Captions, CaptionsOff, Check, MessageSquare, Mic, MicOff, MonitorUp, PhoneOff, Send, Users, Video, VideoOff, X } from 'lucide-react'
import { api } from '../api/client'
import type { Consultation, Segment } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import AudioWaveform from '../components/AudioWaveform'
import { BrandMark } from '../components/Layout'
import { Alert, Avatar, FullPageSpinner, RoleBadge, Spinner } from '../components/ui'
import { useLocalMedia } from '../rtc/useMedia'
import { useRoom, type RemotePeer } from '../rtc/useRoom'
import { SPEECH_LANGS, useSpeech } from '../rtc/useSpeech'
import { fmtClock, fmtOffset } from '../lib/format'

function VideoEl({ stream, muted, mirror }: { stream: MediaStream | null; muted?: boolean; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream
  }, [stream])
  return <video ref={ref} autoPlay playsInline muted={muted} className={mirror ? 'mirror' : ''} />
}

function Tile({ name, role, stream, videoOn, audioOn, self, conn, screen }: {
  name: string; role: string; stream: MediaStream | null; videoOn: boolean; audioOn: boolean; self?: boolean; conn?: string; screen?: boolean
}) {
  const [level, setLevel] = useState(0)
  const hasVideo = !!stream && stream.getVideoTracks().length > 0 && (videoOn || screen)
  return (
    <div className={`tile${level > 0.08 ? ' speaking' : ''}`}>
      <VideoEl stream={stream} muted={self} mirror={self && !screen} />
      {!hasVideo && <div className="ph" style={{ background: '#12292e' }}><Avatar name={name} /></div>}
      <div className="label">{audioOn ? <Mic size={13} /> : <MicOff size={13} color="#f08b7a" />}<b>{name}{self ? ' (you)' : ''}</b><span style={{ opacity: 0.7 }}>{role}</span></div>
      <div className="wave"><AudioWaveform stream={stream} onLevel={setLevel} /></div>
      {conn && conn !== 'connected' && <span className="conn badge neutral">{conn === 'new' ? 'connecting' : conn}</span>}
    </div>
  )
}

export default function RoomPage() {
  const { code = '' } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const [c, setC] = useState<Consultation | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)
  const media = useLocalMedia()

  useEffect(() => {
    api.consultation(code).then(setC).catch((e) => setLoadErr(e.message))
  }, [code])

  if (loadErr) return <div className="center-screen"><div className="card card-pad stack" style={{ maxWidth: 440 }}><Alert kind="error">{loadErr}</Alert><Link className="btn" to="/">Back to dashboard</Link></div></div>
  if (!c || !user) return <FullPageSpinner label="Opening consultation room" />
  if (c.status === 'completed' || c.status === 'cancelled') {
    return (
      <div className="center-screen"><div className="card card-pad stack" style={{ maxWidth: 440 }}>
        <h2>This consultation has {c.status === 'completed' ? 'ended' : 'been cancelled'}</h2>
        <Link className="btn" to={`/consultations/${c.id}`}>View consultation</Link>
      </div></div>
    )
  }

  if (!joined) {
    return (
      <div className="main" style={{ minHeight: '100vh', display: 'grid', alignItems: 'center' }}>
        <div className="prejoin reveal">
          <div className="preview">
            {media.stream && media.videoOn ? <video autoPlay playsInline muted ref={(v) => { if (v && v.srcObject !== media.stream) v.srcObject = media.stream }} />
              : <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#e9f0ef' }}><Avatar name={user.name} size="lg" /></div>}
            <div className="controls">
              <button className={`ctl${media.audioOn ? '' : ' off'}`} onClick={media.toggleAudio} aria-label="Toggle microphone">{media.audioOn ? <Mic size={20} /> : <MicOff size={20} />}</button>
              <button className={`ctl${media.videoOn ? '' : ' off'}`} onClick={media.toggleVideo} aria-label="Toggle camera">{media.videoOn ? <Video size={20} /> : <VideoOff size={20} />}</button>
            </div>
            <div style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(8,20,23,.7)', padding: '6px 10px', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'center', color: '#e9f0ef', fontSize: 13 }}>
              <Mic size={14} /> <AudioWaveform stream={media.stream} bars={12} />
            </div>
          </div>
          <div className="stack">
            <div className="row"><BrandMark /><span className="tiny muted">MedTrust consultation</span></div>
            <h1>{user.role === 'patient' ? `Visit with ${c.doctor_name}` : c.patient_name}</h1>
            <p className="muted" style={{ margin: 0 }}>{c.reason || 'Teleconsultation'} - room <span className="mono">{c.room_code}</span></p>
            {media.error && <Alert kind="warn">{media.error} <button className="btn ghost sm" onClick={() => void media.retry()}>Retry</button></Alert>}
            {user.role === 'patient' && <Alert kind="info">You will wait in the lobby until the doctor admits you. Your speech is transcribed for your medical record.</Alert>}
            {user.role !== 'patient' && <span className="muted small">Your microphone is transcribed live and attributed to you. Everyone sees captions in real time.</span>}
            <div className="row wrap">
              <button className="btn signal" onClick={() => setJoined(true)}><Video size={16} /> {user.role === 'patient' ? 'Ask to join' : 'Join now'}</button>
              <button className="btn ghost" onClick={() => nav(-1)}>Back</button>
            </div>
          </div>
        </div>
      </div>
    )
  }
  return <Call c={c} setC={setC} media={media} />
}

function Call({ c, setC, media }: { c: Consultation; setC: (c: Consultation) => void; media: ReturnType<typeof useLocalMedia> }) {
  const { user } = useAuth()
  const nav = useNavigate()
  const [segments, setSegments] = useState<Segment[]>([])
  const [tab, setTab] = useState<'transcript' | 'people' | 'chat'>('transcript')
  const [captions, setCaptions] = useState(true)
  const [lang, setLang] = useState('en-IN')
  const [localInterim, setLocalInterim] = useState('')
  const [screen, setScreen] = useState<MediaStream | null>(null)
  const [now, setNow] = useState(Date.now())
  const [startedAt, setStartedAt] = useState<string | null>(c.started_at ?? null)
  const [err, setErr] = useState<string | null>(null)
  const [chatText, setChatText] = useState('')
  const [ended, setEnded] = useState(false)
  const pane = useRef<HTMLDivElement>(null)
  const isDoctor = user?.role === 'doctor'

  const reload = useCallback(() => { api.transcript(c.id).then(setSegments).catch(() => {}) }, [c.id])
  useEffect(reload, [reload])
  const onSegment = useCallback((s: Segment) => setSegments((x) => (x.some((y) => y.id === s.id) ? x : [...x, s])), [])
  const onStatus = useCallback((s: string) => {
    if (s === 'completed' || s === 'cancelled') setEnded(true)
    if (s === 'live') setStartedAt((v) => v ?? new Date().toISOString())
  }, [])

  const room = useRoom({ consultationId: c.id, localStream: media.stream, onSegment, onReload: reload, onStatus })
  const inCall = room.phase === 'in_call'

  // Doctor/student start the clock on first join
  useEffect(() => {
    if (inCall && user?.role !== 'patient' && c.status === 'scheduled') {
      api.startConsultation(c.id).then((cc) => { setC(cc); setStartedAt(cc.started_at ?? new Date().toISOString()) }).catch(() => {})
    }
  }, [inCall, c.id, c.status, user?.role, setC])

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    room.setMedia({ audio: media.audioOn, video: media.videoOn })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inCall, media.audioOn, media.videoOn])

  const speech = useSpeech({
    enabled: inCall && captions && media.audioOn,
    lang,
    onInterim: (t) => { setLocalInterim(t); room.sendInterim(t) },
    onFinal: (t) => { setLocalInterim(''); room.sendFinal(t, crypto.randomUUID(), lang) },
  })

  useEffect(() => {
    if (tab === 'transcript' && pane.current) pane.current.scrollTop = pane.current.scrollHeight
  }, [segments, room.interims, localInterim, tab])

  const leave = () => {
    room.leave()
    media.release()
    screen?.getTracks().forEach((t) => t.stop())
    nav(`/consultations/${c.id}`)
  }
  const endForAll = async () => {
    if (!confirm('End this consultation for everyone? The transcript will be finalised.')) return
    try {
      await api.endConsultation(c.id)
      leave()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }
  const toggleScreen = async () => {
    try {
      if (screen) {
        await room.shareScreen(false)
        setScreen(null)
      } else {
        const s = await room.shareScreen(true)
        if (s) {
          s.getVideoTracks()[0].onended = () => { void room.shareScreen(false); setScreen(null) }
          setScreen(s)
        }
      }
    } catch {
      setErr('Screen sharing was cancelled or is not supported.')
    }
  }
  const sendChat = (e: FormEvent) => {
    e.preventDefault()
    if (chatText.trim()) room.sendChat(chatText.trim())
    setChatText('')
  }

  if (ended || room.phase === 'closed') {
    return (
      <div className="center-screen"><div className="card card-pad stack" style={{ maxWidth: 460 }}>
        <h2>The consultation has ended</h2>
        <p className="muted" style={{ margin: 0 }}>{user?.role === 'patient' ? 'Your doctor will review and sign the case sheet. It will appear under My case sheets.' : 'Generate and review the AI case sheet from the consultation page.'}</p>
        <button className="btn" onClick={leave}>Continue</button>
      </div></div>
    )
  }
  if (room.phase === 'denied') {
    return <div className="center-screen"><div className="card card-pad stack" style={{ maxWidth: 420 }}><h2>Entry declined</h2><p className="muted">The care team did not admit you to this room.</p><Link className="btn" to="/">Back</Link></div></div>
  }
  if (room.phase === 'error') {
    return <div className="center-screen"><div className="card card-pad stack" style={{ maxWidth: 420 }}><Alert kind="error">You do not have access to this room, or your session expired.</Alert><Link className="btn" to="/login">Sign in again</Link></div></div>
  }

  const remotes = Object.values(room.remotes).filter((r) => r.admitted !== false)
  const waiting = room.roster.filter((p) => !p.admitted)
  const admittedRoster = room.roster.filter((p) => p.admitted)
  const elapsed = startedAt ? (now - new Date(startedAt).getTime()) / 1000 : 0
  const n = Math.min(6, remotes.length + 1)

  return (
    <div className="room">
      <div className="room-top">
        <BrandMark />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="title">{user?.role === 'patient' ? c.doctor_name : c.patient_name}</div>
          <div className="small" style={{ opacity: 0.6 }}>{c.reason || 'Teleconsultation'} - {c.room_code}</div>
        </div>
        {inCall && <span className="badge live">Live</span>}
        <span className="timer" aria-label="Call duration">{fmtClock(elapsed)}</span>
        {room.socketState !== 'open' && <span className="badge warn">{room.socketState === 'reconnecting' ? 'Reconnecting' : 'Offline'}</span>}
        {speech.active && <span className="badge ok" title="Your speech is being transcribed"><Captions size={12} /> Transcribing</span>}
      </div>

      <div className={`room-stage n${n}`}>
        {room.phase === 'waiting' || room.phase === 'connecting' ? (
          <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
            <Spinner light />
            <h2>{room.phase === 'waiting' ? 'Waiting for the doctor to let you in' : 'Connecting to the room'}</h2>
            <p style={{ opacity: 0.7 }}>{room.phase === 'waiting' ? 'The care team has been notified. Please keep this page open.' : ''}</p>
            <div style={{ width: 'min(420px, 90vw)' }}><Tile name={user?.name ?? ''} role={user?.role ?? ''} stream={media.stream} videoOn={media.videoOn} audioOn={media.audioOn} self /></div>
          </div>
        ) : (
          <>
            <Tile name={user?.name ?? ''} role={user?.role ?? ''} stream={screen ?? media.stream} videoOn={media.videoOn} audioOn={media.audioOn} self screen={!!screen} />
            {remotes.map((r: RemotePeer) => (
              <Tile key={r.peer_id} name={r.name} role={r.role} stream={r.stream} videoOn={r.media.video} audioOn={r.media.audio} conn={r.connection} screen={r.media.screen} />
            ))}
            {remotes.length === 0 && (
              <div className="tile" style={{ display: 'grid', placeItems: 'center', textAlign: 'center', padding: 20 }}>
                <div style={{ opacity: 0.75 }}>
                  <Users size={30} />
                  <p>Waiting for others to join.<br /><span className="small mono">{location.origin}{c.join_path}</span></p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="room-bar">
        <button className={`ctl${media.audioOn ? '' : ' off'}`} onClick={media.toggleAudio} title={media.audioOn ? 'Mute' : 'Unmute'} aria-label="Toggle microphone">{media.audioOn ? <Mic size={20} /> : <MicOff size={20} />}</button>
        <button className={`ctl${media.videoOn ? '' : ' off'}`} onClick={media.toggleVideo} title="Camera" aria-label="Toggle camera">{media.videoOn ? <Video size={20} /> : <VideoOff size={20} />}</button>
        <button className={`ctl${screen ? ' on' : ''}`} onClick={toggleScreen} disabled={!inCall} title="Share screen" aria-label="Share screen"><MonitorUp size={20} /></button>
        <button className={`ctl${captions ? ' on' : ''}`} onClick={() => setCaptions(!captions)} title="Live transcription" aria-label="Toggle transcription">{captions ? <Captions size={20} /> : <CaptionsOff size={20} />}</button>
        <select className="input" style={{ width: 160, background: '#23434a', color: '#e9f0ef', border: 'none' }} value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Speech language">
          {SPEECH_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <button className="ctl end" onClick={leave} title="Leave" aria-label="Leave call"><PhoneOff size={20} /></button>
        {isDoctor && inCall && <button className="btn danger sm" onClick={endForAll}>End for all</button>}
      </div>

      <aside className="room-side">
        <div className="tabs" role="tablist">
          <button className={tab === 'transcript' ? 'on' : ''} onClick={() => setTab('transcript')}><Captions size={13} /> Transcript</button>
          <button className={tab === 'people' ? 'on' : ''} onClick={() => setTab('people')}><Users size={13} /> People{waiting.length ? ` (${waiting.length})` : ''}</button>
          <button className={tab === 'chat' ? 'on' : ''} onClick={() => setTab('chat')}><MessageSquare size={13} /> Chat</button>
        </div>
        {(err || speech.error || media.error) && <div style={{ padding: '0 14px 10px' }}><Alert kind="warn" onClose={err ? () => setErr(null) : undefined}>{err || speech.error || media.error}</Alert></div>}
        {waiting.length > 0 && user?.role !== 'patient' && tab !== 'people' && (
          <div style={{ padding: '0 14px 10px' }}><Alert kind="info">{waiting[0].name} is waiting. <button className="btn sm ok" onClick={() => room.admit(waiting[0].peer_id)}>Admit</button></Alert></div>
        )}
        <div className="pane" ref={pane}>
          {tab === 'transcript' && (
            <>
              {segments.length === 0 && !localInterim && Object.keys(room.interims).length === 0 && (
                <p className="muted small">Captions appear here as people speak. Each device transcribes its own microphone so speakers are attributed exactly.</p>
              )}
              {segments.map((s) => (
                <div key={s.id} className={`seg ${s.speaker_role}`}><span className="bar" /><div>
                  <div className="meta"><b>{s.speaker_name}</b><span className="mono">{fmtOffset(s.offset_ms)}</span></div>
                  <p>{s.text}</p>
                </div></div>
              ))}
              {Object.values(room.interims).filter((i) => i.text).map((i) => (
                <div key={i.peer_id} className={`seg interim ${i.role}`}><span className="bar" /><div><div className="meta"><b>{i.name}</b><span>speaking...</span></div><p>{i.text}</p></div></div>
              ))}
              {localInterim && user && (
                <div className={`seg interim ${user.role}`}><span className="bar" /><div><div className="meta"><b>{user.name}</b><span>speaking...</span></div><p>{localInterim}</p></div></div>
              )}
            </>
          )}
          {tab === 'people' && (
            <div className="stack" style={{ gap: 8 }}>
              {waiting.length > 0 && <div className="tiny muted">Waiting lobby</div>}
              {waiting.map((p) => (
                <div key={p.peer_id} className="row card" style={{ padding: 10 }}>
                  <Avatar name={p.name} /><div style={{ flex: 1 }}><b>{p.name}</b><div><RoleBadge role={p.role} /></div></div>
                  {user?.role !== 'patient' && <>
                    <button className="btn icon ok" onClick={() => room.admit(p.peer_id)} aria-label={`Admit ${p.name}`}><Check size={16} /></button>
                    <button className="btn icon danger" onClick={() => room.deny(p.peer_id)} aria-label={`Deny ${p.name}`}><X size={16} /></button>
                  </>}
                </div>
              ))}
              <div className="tiny muted">In call ({admittedRoster.length})</div>
              {admittedRoster.map((p) => (
                <div key={p.peer_id} className="row" style={{ padding: '6px 0' }}>
                  <Avatar name={p.name} /><div style={{ flex: 1 }}><b>{p.name}</b>{p.peer_id === room.selfId && <span className="muted small"> (you)</span>}<div><RoleBadge role={p.role} /></div></div>
                  {p.media.audio ? <Mic size={15} /> : <MicOff size={15} color="var(--danger)" />}
                  {p.media.video ? <Video size={15} /> : <VideoOff size={15} color="var(--danger)" />}
                </div>
              ))}
            </div>
          )}
          {tab === 'chat' && (
            <div>
              {room.chat.length === 0 && <p className="muted small">Messages are visible to everyone in the call and are not saved.</p>}
              {room.chat.map((m, i) => <div key={i} className="chat-msg"><b>{m.from}</b> <span className="muted small">{new Date(m.at).toLocaleTimeString()}</span><div>{m.text}</div></div>)}
            </div>
          )}
        </div>
        {tab === 'chat' && (
          <form className="row" style={{ padding: 12, borderTop: '1px solid var(--line)' }} onSubmit={sendChat}>
            <input className="input" value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Message" disabled={!inCall} />
            <button className="btn icon" disabled={!inCall} aria-label="Send"><Send size={16} /></button>
          </form>
        )}
      </aside>
    </div>
  )
}
