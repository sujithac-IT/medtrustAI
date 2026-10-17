"""Realtime hub: presence, waiting room, WebRTC signalling relay, live transcript fan-out.

`MemoryHub` (default) keeps everything in this process: ideal for one small server.
`RedisHub` (REDIS_URL set) shares rosters through Redis hashes and relays messages over one pub/sub
channel, so any number of API instances can serve the same consultation room behind a load balancer.
Each instance only holds the sockets connected to it; peers of crashed instances expire via heartbeats.
"""
import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from fastapi import WebSocket

log = logging.getLogger("medtrust.realtime")
ADMIT_MEMORY_S = 12 * 3600  # a patient admitted once re-enters directly after a network drop


@dataclass
class Peer:
    peer_id: str
    ws: WebSocket
    user: dict[str, Any]
    admitted: bool
    cid: str = ""
    media: dict[str, bool] = field(default_factory=lambda: {"audio": True, "video": True, "screen": False})
    # token bucket for inbound message rate limiting
    tokens: float = 60.0
    last: float = field(default_factory=time.monotonic)

    def public(self) -> dict[str, Any]:
        return {"peer_id": self.peer_id, "user_id": self.user["id"], "name": self.user["name"],
                "role": self.user["role"], "admitted": self.admitted, "media": self.media}

    def allow(self, rate: float = 30.0, burst: float = 60.0) -> bool:
        now = time.monotonic()
        self.tokens = min(burst, self.tokens + (now - self.last) * rate)
        self.last = now
        if self.tokens < 1:
            return False
        self.tokens -= 1
        return True


async def _safe_send(ws: WebSocket, msg: dict[str, Any]) -> bool:
    try:
        await ws.send_json(msg)
        return True
    except Exception:
        return False


async def _safe_close(ws: WebSocket, code: int, reason: str) -> None:
    try:
        await ws.close(code=code, reason=reason)
    except Exception:
        pass


class MemoryHub:
    """Single-process hub."""

    def __init__(self) -> None:
        self.rooms: dict[str, dict[str, Peer]] = {}
        self.watchers: set[WebSocket] = set()
        self.admit_memory: dict[str, dict[str, float]] = {}

    async def start(self) -> None:
        pass

    async def stop(self) -> None:
        pass

    def new_peer_id(self) -> str:
        return uuid.uuid4().hex[:12]

    # ---- membership
    async def join(self, peer: Peer) -> None:
        self.rooms.setdefault(peer.cid, {})[peer.peer_id] = peer

    async def leave(self, peer: Peer) -> None:
        room = self.rooms.get(peer.cid, {})
        room.pop(peer.peer_id, None)
        if not room:
            self.rooms.pop(peer.cid, None)

    async def peers(self, cid: str) -> list[dict[str, Any]]:
        return [p.public() for p in self.rooms.get(cid, {}).values()]

    async def peer(self, cid: str, peer_id: str) -> dict[str, Any] | None:
        p = self.rooms.get(cid, {}).get(peer_id)
        return p.public() if p else None

    async def set_admitted(self, cid: str, peer_id: str) -> dict[str, Any] | None:
        p = self.rooms.get(cid, {}).get(peer_id)
        if not p or p.admitted:
            return None
        p.admitted = True
        await self.remember_admitted(cid, p.user["id"])
        return p.public()

    async def set_media(self, peer: Peer, media: dict[str, bool]) -> None:
        peer.media.update(media)

    async def remember_admitted(self, cid: str, user_id: str) -> None:
        self.admit_memory.setdefault(cid, {})[user_id] = time.time() + ADMIT_MEMORY_S

    async def was_admitted(self, cid: str, user_id: str) -> bool:
        return self.admit_memory.get(cid, {}).get(user_id, 0) > time.time()

    # ---- delivery
    async def send_to(self, cid: str, peer_id: str, msg: dict[str, Any]) -> None:
        p = self.rooms.get(cid, {}).get(peer_id)
        if p:
            await _safe_send(p.ws, msg)

    async def broadcast(self, cid: str, msg: dict[str, Any], *, admitted_only: bool = True,
                        exclude: str | None = None) -> None:
        targets = [p for p in self.rooms.get(cid, {}).values()
                   if (p.admitted or not admitted_only) and p.peer_id != exclude]
        await asyncio.gather(*(_safe_send(p.ws, msg) for p in targets))

    async def close_room(self, cid: str, code: int, reason: str, final: dict[str, Any] | None = None) -> None:
        for p in list(self.rooms.get(cid, {}).values()):
            if final:
                await _safe_send(p.ws, final)
            await _safe_close(p.ws, code, reason)
        self.admit_memory.pop(cid, None)

    async def disconnect_user(self, user_id: str, code: int = 4401, reason: str = "Session ended") -> None:
        for room in list(self.rooms.values()):
            for p in list(room.values()):
                if p.user["id"] == user_id:
                    await _safe_close(p.ws, code, reason)

    async def notify_watchers(self, msg: dict[str, Any]) -> None:
        """Waiting-room alerts go only to the consultation's own staff and to administrators."""
        def wants(ws: WebSocket) -> bool:
            u = getattr(ws.state, "user", None) or {}
            return bool(u.get("is_admin")) or u.get("id") in (msg.get("doctor_id"), msg.get("student_id"))
        dead = [ws for ws in list(self.watchers) if wants(ws) and not await _safe_send(ws, msg)]
        for ws in dead:
            self.watchers.discard(ws)

    async def live_summary(self) -> dict[str, dict[str, int]]:
        out = {}
        for cid, room in self.rooms.items():
            if room:
                adm = sum(1 for p in room.values() if p.admitted)
                out[cid] = {"admitted": adm, "waiting": len(room) - adm}
        return out

    async def healthy(self) -> bool:
        return True


class RedisHub(MemoryHub):
    """Multi-instance hub. Local sockets live in `self.rooms`; shared state lives in Redis."""
    CHANNEL = "mt:bus"
    HEARTBEAT_S = 10
    INSTANCE_TTL_S = 30

    def __init__(self, url: str) -> None:
        super().__init__()
        import redis.asyncio as aioredis
        self.r = aioredis.Redis.from_url(url, decode_responses=True)
        self.instance = uuid.uuid4().hex[:10]
        self.tasks: list[asyncio.Task] = []

    @staticmethod
    def _peers_key(cid: str) -> str:
        return f"mt:room:{cid}:peers"

    async def start(self) -> None:
        await self.r.set(f"mt:inst:{self.instance}", "1", ex=self.INSTANCE_TTL_S)
        self.pubsub = self.r.pubsub()
        await self.pubsub.subscribe(self.CHANNEL)
        self.tasks = [asyncio.create_task(self._listen()), asyncio.create_task(self._heartbeat())]

    async def stop(self) -> None:
        for t in self.tasks:
            t.cancel()
        try:
            for cid, room in list(self.rooms.items()):
                if room:
                    await self.r.hdel(self._peers_key(cid), *room.keys())
            await self.r.delete(f"mt:inst:{self.instance}")
            await self.pubsub.aclose()
            await self.r.aclose()
        except Exception:
            pass

    async def _heartbeat(self) -> None:
        while True:
            try:
                await self.r.set(f"mt:inst:{self.instance}", "1", ex=self.INSTANCE_TTL_S)
            except Exception as e:
                log.warning("redis heartbeat failed: %s", e)
            await asyncio.sleep(self.HEARTBEAT_S)

    async def _publish(self, env: dict[str, Any]) -> None:
        await self.r.publish(self.CHANNEL, json.dumps(env))

    async def _listen(self) -> None:
        while True:
            try:
                async for m in self.pubsub.listen():
                    if m.get("type") == "message":
                        await self._handle(json.loads(m["data"]))
            except asyncio.CancelledError:
                raise
            except Exception as e:  # reconnect on transient Redis errors
                log.warning("redis bus error: %s", e)
                await asyncio.sleep(1)
                try:
                    await self.pubsub.subscribe(self.CHANNEL)
                except Exception:
                    pass

    async def _handle(self, env: dict[str, Any]) -> None:
        kind, cid = env.get("kind"), env.get("cid", "")
        room = self.rooms.get(cid, {})
        if kind == "deliver":
            if env.get("to"):
                p = room.get(env["to"])
                if p:
                    await _safe_send(p.ws, env["msg"])
                return
            await MemoryHub.broadcast(self, cid, env["msg"], admitted_only=env["admitted_only"],
                                      exclude=env.get("exclude"))
        elif kind == "admit":
            p = room.get(env["peer_id"])
            if p:
                p.admitted = True
        elif kind == "close_room":
            await MemoryHub.close_room(self, cid, env["code"], env["reason"], env.get("final"))
        elif kind == "disconnect_user":
            await MemoryHub.disconnect_user(self, env["user_id"], env["code"], env["reason"])
        elif kind == "watchers":
            await MemoryHub.notify_watchers(self, env["msg"])

    # ---- shared roster
    async def _store(self, peer: Peer) -> None:
        await self.r.hset(self._peers_key(peer.cid), peer.peer_id,
                          json.dumps({**peer.public(), "instance": self.instance}))
        await self.r.expire(self._peers_key(peer.cid), 24 * 3600)

    async def join(self, peer: Peer) -> None:
        await MemoryHub.join(self, peer)
        await self._store(peer)
        await self.r.sadd("mt:rooms", peer.cid)

    async def leave(self, peer: Peer) -> None:
        await MemoryHub.leave(self, peer)
        await self.r.hdel(self._peers_key(peer.cid), peer.peer_id)
        if not await self.r.hlen(self._peers_key(peer.cid)):
            await self.r.srem("mt:rooms", peer.cid)

    async def _all(self, cid: str) -> dict[str, dict[str, Any]]:
        raw = await self.r.hgetall(self._peers_key(cid))
        out, stale = {}, []
        alive: dict[str, bool] = {}
        for pid, js in raw.items():
            d = json.loads(js)
            inst = d.pop("instance", "")
            if inst not in alive:
                alive[inst] = inst == self.instance or bool(await self.r.exists(f"mt:inst:{inst}"))
            if alive[inst]:
                out[pid] = d
            else:
                stale.append(pid)
        if stale:
            await self.r.hdel(self._peers_key(cid), *stale)
        return out

    async def peers(self, cid: str) -> list[dict[str, Any]]:
        return list((await self._all(cid)).values())

    async def peer(self, cid: str, peer_id: str) -> dict[str, Any] | None:
        return (await self._all(cid)).get(peer_id)

    async def set_admitted(self, cid: str, peer_id: str) -> dict[str, Any] | None:
        key = self._peers_key(cid)
        js = await self.r.hget(key, peer_id)
        if not js:
            return None
        d = json.loads(js)
        if d.get("admitted"):
            return None
        d["admitted"] = True
        await self.r.hset(key, peer_id, json.dumps(d))
        local = self.rooms.get(cid, {}).get(peer_id)
        if local:
            local.admitted = True
        else:
            await self._publish({"kind": "admit", "cid": cid, "peer_id": peer_id})
        await self.remember_admitted(cid, d["user_id"])
        d.pop("instance", None)
        return d

    async def set_media(self, peer: Peer, media: dict[str, bool]) -> None:
        peer.media.update(media)
        await self._store(peer)

    async def remember_admitted(self, cid: str, user_id: str) -> None:
        await self.r.set(f"mt:room:{cid}:adm:{user_id}", "1", ex=ADMIT_MEMORY_S)

    async def was_admitted(self, cid: str, user_id: str) -> bool:
        return bool(await self.r.exists(f"mt:room:{cid}:adm:{user_id}"))

    # ---- delivery: local fast path, bus for everything else
    async def send_to(self, cid: str, peer_id: str, msg: dict[str, Any]) -> None:
        p = self.rooms.get(cid, {}).get(peer_id)
        if p:
            await _safe_send(p.ws, msg)
        else:
            await self._publish({"kind": "deliver", "cid": cid, "to": peer_id, "msg": msg})

    async def broadcast(self, cid: str, msg: dict[str, Any], *, admitted_only: bool = True,
                        exclude: str | None = None) -> None:
        await self._publish({"kind": "deliver", "cid": cid, "msg": msg, "admitted_only": admitted_only,
                             "exclude": exclude})

    async def close_room(self, cid: str, code: int, reason: str, final: dict[str, Any] | None = None) -> None:
        await self._publish({"kind": "close_room", "cid": cid, "code": code, "reason": reason, "final": final})
        keys = [k async for k in self.r.scan_iter(f"mt:room:{cid}:adm:*")]
        if keys:
            await self.r.delete(*keys)

    async def disconnect_user(self, user_id: str, code: int = 4401, reason: str = "Session ended") -> None:
        await self._publish({"kind": "disconnect_user", "user_id": user_id, "code": code, "reason": reason})

    async def notify_watchers(self, msg: dict[str, Any]) -> None:
        await self._publish({"kind": "watchers", "msg": msg})

    async def live_summary(self) -> dict[str, dict[str, int]]:
        out = {}
        for cid in await self.r.smembers("mt:rooms"):
            peers = await self.peers(cid)
            if peers:
                adm = sum(1 for p in peers if p["admitted"])
                out[cid] = {"admitted": adm, "waiting": len(peers) - adm}
            else:
                await self.r.srem("mt:rooms", cid)
        return out

    async def healthy(self) -> bool:
        try:
            return bool(await self.r.ping())
        except Exception:
            return False


def make_hub() -> MemoryHub:
    from .config import get_settings
    url = get_settings().redis_url
    return RedisHub(url) if url else MemoryHub()


hub: MemoryHub = make_hub()
