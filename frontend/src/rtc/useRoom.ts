/**
 * Consultation room client: WebSocket signalling + WebRTC mesh (perfect negotiation) + live transcript.
 * Protocol: docs/API_CONTRACT.md section 4.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, wsUrl } from '../api/client'
import type { Role, Segment } from '../api/types'

export interface PeerInfo {
  peer_id: string
  user_id: string
  name: string
  role: Role
  admitted: boolean
  media: { audio: boolean; video: boolean; screen: boolean }
}

export interface RemotePeer extends PeerInfo {
  stream: MediaStream | null
  connection: RTCPeerConnectionState | 'new'
}

export interface Interim { peer_id: string; name: string; role: Role; text: string; at: number }
export interface ChatMsg { from: string; role: Role; text: string; at: string }

type Phase = 'connecting' | 'waiting' | 'in_call' | 'denied' | 'closed' | 'error'

interface Options {
  consultationId: string | null
  localStream: MediaStream | null
  onSegment: (s: Segment) => void
  onReload: () => void
  onStatus: (status: string) => void
}

export function useRoom({ consultationId, localStream, onSegment, onReload, onStatus }: Options) {
  const [phase, setPhase] = useState<Phase>('connecting')
  const [selfId, setSelfId] = useState<string>('')
  const [roster, setRoster] = useState<PeerInfo[]>([])
  const [remotes, setRemotes] = useState<Record<string, RemotePeer>>({})
  const [interims, setInterims] = useState<Record<string, Interim>>({})
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [socketState, setSocketState] = useState<'open' | 'reconnecting' | 'closed'>('reconnecting')
  const [notice, setNotice] = useState<string | null>(null)
  // Final transcript lines not yet confirmed by the server: resent after a reconnect (server de-duplicates).
  const pending = useRef<Map<string, { type: 'transcript.final'; text: string; client_id: string; language: string }>>(new Map())
  const admittedRef = useRef(false)

  const ws = useRef<WebSocket | null>(null)
  const pcs = useRef<Map<string, { pc: RTCPeerConnection; polite: boolean; makingOffer: boolean; ignoreOffer: boolean }>>(new Map())
  const ice = useRef<RTCIceServer[]>([{ urls: 'stun:stun.l.google.com:19302' }])
  const self = useRef('')
  const stream = useRef<MediaStream | null>(localStream)
  const screenTrack = useRef<MediaStreamTrack | null>(null)
  const cb = useRef({ onSegment, onReload, onStatus })
  cb.current = { onSegment, onReload, onStatus }
  const closedByUs = useRef(false)

  const send = useCallback((msg: unknown) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(msg))
  }, [])
  const flushPending = useCallback(() => {
    if (!admittedRef.current) return
    for (const m of pending.current.values()) send(m)
  }, [send])

  const patchRemote = (id: string, p: Partial<RemotePeer>) =>
    setRemotes((r) => (r[id] ? { ...r, [id]: { ...r[id], ...p } } : r))

  const dropPeer = useCallback((id: string) => {
    pcs.current.get(id)?.pc.close()
    pcs.current.delete(id)
    setRemotes((r) => {
      const n = { ...r }
      delete n[id]
      return n
    })
    setInterims((r) => {
      const n = { ...r }
      delete n[id]
      return n
    })
  }, [])

  const ensurePeer = useCallback((info: PeerInfo) => {
    if (pcs.current.has(info.peer_id)) return pcs.current.get(info.peer_id)!
    const pc = new RTCPeerConnection({ iceServers: ice.current })
    // Deterministic politeness: lexicographically larger id yields on glare
    const entry = { pc, polite: self.current > info.peer_id, makingOffer: false, ignoreOffer: false }
    pcs.current.set(info.peer_id, entry)
    setRemotes((r) => ({ ...r, [info.peer_id]: { ...info, stream: r[info.peer_id]?.stream ?? null, connection: 'new' } }))

    const s = stream.current
    if (s) {
      for (const track of s.getTracks()) {
        const t = track.kind === 'video' && screenTrack.current ? screenTrack.current : track
        pc.addTrack(t, s)
      }
    } else {
      pc.addTransceiver('audio', { direction: 'recvonly' })
      pc.addTransceiver('video', { direction: 'recvonly' })
    }
    pc.ontrack = (ev) => {
      const remoteStream = ev.streams[0] ?? new MediaStream([ev.track])
      patchRemote(info.peer_id, { stream: remoteStream })
    }
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) send({ type: 'signal', to: info.peer_id, data: { candidate } })
    }
    pc.onnegotiationneeded = async () => {
      try {
        entry.makingOffer = true
        await pc.setLocalDescription()
        send({ type: 'signal', to: info.peer_id, data: { description: pc.localDescription } })
      } catch (e) {
        console.warn('negotiation failed', e)
      } finally {
        entry.makingOffer = false
      }
    }
    pc.onconnectionstatechange = () => {
      patchRemote(info.peer_id, { connection: pc.connectionState })
      if (pc.connectionState === 'failed') pc.restartIce()
    }
    return entry
  }, [send])

  const handleSignal = useCallback(async (from: string, data: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) => {
    let entry = pcs.current.get(from)
    if (!entry) {
      const info = roster.find((p) => p.peer_id === from) ?? { peer_id: from, user_id: '', name: 'Participant', role: 'patient' as Role, admitted: true, media: { audio: true, video: true, screen: false } }
      entry = ensurePeer(info)
    }
    const { pc } = entry
    try {
      if (data.description) {
        const collision = data.description.type === 'offer' && (entry.makingOffer || pc.signalingState !== 'stable')
        entry.ignoreOffer = !entry.polite && collision
        if (entry.ignoreOffer) return
        await pc.setRemoteDescription(data.description)
        if (data.description.type === 'offer') {
          await pc.setLocalDescription()
          send({ type: 'signal', to: from, data: { description: pc.localDescription } })
        }
      } else if (data.candidate) {
        try {
          await pc.addIceCandidate(data.candidate)
        } catch (e) {
          if (!entry.ignoreOffer) throw e
        }
      }
    } catch (e) {
      console.warn('signal error', e)
    }
  }, [ensurePeer, roster, send])

  const handlerRef = useRef<(m: Record<string, unknown>) => void>(() => {})
  handlerRef.current = (m) => {
    switch (m.type) {
      case 'welcome': {
        self.current = m.peer_id as string
        setSelfId(self.current)
        ice.current = (m.ice_servers as RTCIceServer[]) ?? ice.current
        admittedRef.current = !!m.admitted
        if (m.admitted) {
          setPhase('in_call')
          flushPending()
          // Newcomer initiates connections to everyone already in the call
          for (const p of m.peers as PeerInfo[]) ensurePeer(p)
        } else setPhase('waiting')
        break
      }
      case 'admitted':
        admittedRef.current = true
        setPhase('in_call')
        flushPending()
        for (const p of m.peers as PeerInfo[]) ensurePeer(p)
        break
      case 'denied':
        setPhase('denied')
        closedByUs.current = true
        ws.current?.close()
        break
      case 'roster':
        setRoster(m.peers as PeerInfo[])
        setRemotes((r) => {
          const n = { ...r }
          for (const p of m.peers as PeerInfo[]) if (n[p.peer_id]) n[p.peer_id] = { ...n[p.peer_id], ...p, stream: n[p.peer_id].stream }
          return n
        })
        break
      case 'peer.joined':
        // Existing members wait for the newcomer's offer; just register the tile
        setRemotes((r) => {
          const p = m.peer as PeerInfo
          return r[p.peer_id] ? r : { ...r, [p.peer_id]: { ...p, stream: null, connection: 'new' } }
        })
        break
      case 'peer.left':
        dropPeer(m.peer_id as string)
        break
      case 'signal':
        void handleSignal(m.from as string, m.data as never)
        break
      case 'media':
        patchRemote(m.peer_id as string, { media: m.media as PeerInfo['media'] })
        break
      case 'transcript.interim': {
        const it = { peer_id: m.peer_id as string, name: m.name as string, role: m.role as Role, text: m.text as string, at: Date.now() }
        setInterims((r) => ({ ...r, [it.peer_id]: it }))
        break
      }
      case 'transcript.final': {
        const seg = m.segment as Segment
        pending.current.delete(seg.client_id)
        cb.current.onSegment(seg)
        setInterims((r) => {
          const n = { ...r }
          for (const k of Object.keys(n)) if (n[k].name === seg.speaker_name) delete n[k]
          return n
        })
        break
      }
      case 'transcript.ack':
        pending.current.delete(m.client_id as string)
        break
      case 'error':
        if (m.code === 'transcript_locked') {
          pending.current.clear()
          setNotice(String(m.detail ?? 'The transcript is locked.'))
        } else if (m.code === 'rate_limited') setNotice('Too many messages - slowing down.')
        break
      case 'transcript.reload':
        cb.current.onReload()
        break
      case 'status':
        cb.current.onStatus(m.status as string)
        if (m.status === 'completed' || m.status === 'cancelled') {
          setPhase('closed')
          closedByUs.current = true
        }
        break
      case 'chat':
        setChat((c) => [...c.slice(-99), m as unknown as ChatMsg])
        break
    }
  }

  // Socket lifecycle with exponential backoff reconnect
  useEffect(() => {
    if (!consultationId) return
    closedByUs.current = false
    let attempt = 0
    let timer: number | undefined
    let ping: number | undefined
    const retry = () => {
      setSocketState('reconnecting')
      setPhase((p) => (p === 'in_call' || p === 'waiting' ? p : 'connecting'))
      timer = window.setTimeout(connect, Math.min(10000, 500 * 2 ** attempt++))
    }
    const connect = async () => {
      if (closedByUs.current) return
      let url: string
      try {
        url = await wsUrl(`/api/consultations/${consultationId}/ws`, consultationId)
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403 || e.status === 404)) {
          setPhase('error')
          setSocketState('closed')
          return
        }
        retry()
        return
      }
      if (closedByUs.current) return
      const sock = new WebSocket(url)
      ws.current = sock
      sock.onopen = () => {
        attempt = 0
        setSocketState('open')
        ping = window.setInterval(() => send({ type: 'ping' }), 20000)
      }
      sock.onmessage = (ev) => {
        try {
          handlerRef.current(JSON.parse(ev.data))
        } catch (e) {
          console.warn('bad ws message', e)
        }
      }
      sock.onclose = (ev) => {
        window.clearInterval(ping)
        admittedRef.current = false
        for (const id of [...pcs.current.keys()]) dropPeer(id)
        if (ev.code === 4409) {
          setPhase('closed')
          return
        }
        if (ev.code === 4401 || ev.code === 4403 || ev.code === 4404) {
          setPhase('error')
          setSocketState('closed')
          return
        }
        if (closedByUs.current) {
          setSocketState('closed')
          return
        }
        retry()
      }
    }
    void connect()
    return () => {
      closedByUs.current = true
      window.clearTimeout(timer)
      window.clearInterval(ping)
      ws.current?.close()
      for (const id of [...pcs.current.keys()]) dropPeer(id)
    }
  }, [consultationId, send, dropPeer, flushPending])

  // Keep outgoing tracks in sync when local stream changes (e.g. permissions granted late)
  useEffect(() => {
    stream.current = localStream
    if (!localStream) return
    for (const { pc } of pcs.current.values()) {
      for (const track of localStream.getTracks()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === track.kind)
        if (sender) void sender.replaceTrack(track.kind === 'video' && screenTrack.current ? screenTrack.current : track)
        else pc.addTrack(track, localStream)
      }
    }
  }, [localStream])

  const setMedia = useCallback((media: Partial<PeerInfo['media']>) => send({ type: 'media', media }), [send])

  const shareScreen = useCallback(async (on: boolean): Promise<MediaStream | null> => {
    if (on) {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      const track = display.getVideoTracks()[0]
      screenTrack.current = track
      for (const { pc } of pcs.current.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
        if (sender) await sender.replaceTrack(track)
        else pc.addTrack(track, display)
      }
      setMedia({ screen: true })
      return display
    }
    screenTrack.current?.stop()
    screenTrack.current = null
    const cam = stream.current?.getVideoTracks()[0] ?? null
    for (const { pc } of pcs.current.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video' || s.track === null)
      if (sender) await sender.replaceTrack(cam)
    }
    setMedia({ screen: false })
    return null
  }, [setMedia])

  return {
    phase, selfId, roster, remotes, interims, chat, socketState, notice, clearNotice: () => setNotice(null),
    admit: (peer_id: string) => send({ type: 'admit', peer_id }),
    deny: (peer_id: string) => send({ type: 'deny', peer_id }),
    sendInterim: (text: string) => send({ type: 'transcript.interim', text }),
    sendFinal: (text: string, client_id: string, language: string) => {
      const msg = { type: 'transcript.final' as const, text, client_id, language }
      if (pending.current.size < 200) pending.current.set(client_id, msg)
      send(msg)
    },
    sendChat: (text: string) => send({ type: 'chat', text }),
    setMedia,
    shareScreen,
    leave: () => {
      closedByUs.current = true
      ws.current?.close()
    },
  }
}
