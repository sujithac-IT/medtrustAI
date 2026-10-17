"""Sliding-window rate limiting with interchangeable backends.

- memory   (default): single process, bounded memory.
- database (DATABASE_URL set, no Redis): shared by every instance that uses the same database.
- redis    (REDIS_URL set): shared, O(log n) per hit, keys expire on their own.
"""
import threading
import time
import uuid
from collections import deque
from typing import Any

from fastapi import HTTPException, status

from .config import get_settings


class MemoryBackend:
    MAX_KEYS = 20_000

    def __init__(self) -> None:
        self.hits: dict[str, deque[float]] = {}
        self.lock = threading.Lock()

    def _recent(self, key: str, window: float, now: float) -> deque[float]:
        q = self.hits.get(key)
        if q is None:
            return deque()
        while q and now - q[0] >= window:
            q.popleft()
        if not q:
            self.hits.pop(key, None)
        return q

    def count(self, key: str, window: float) -> tuple[int, float]:
        now = time.time()
        with self.lock:
            q = self._recent(key, window, now)
            return len(q), (q[0] if q else now)

    def add(self, key: str, window: float) -> None:
        now = time.time()
        with self.lock:
            if len(self.hits) > self.MAX_KEYS:  # drop idle keys to keep memory bounded
                for k in [k for k, q in self.hits.items() if not q or now - q[-1] >= 3600][: self.MAX_KEYS // 2]:
                    self.hits.pop(k, None)
            self.hits.setdefault(key, deque()).append(now)

    def reset(self, key: str) -> None:
        with self.lock:
            self.hits.pop(key, None)

    def clear(self) -> None:
        with self.lock:
            self.hits.clear()


class DatabaseBackend:
    def count(self, key: str, window: float) -> tuple[int, float]:
        from .db import tx
        now = time.time()
        with tx() as c:
            c.execute("DELETE FROM rate_events WHERE key=? AND at < ?", (key, now - window))
            r = c.execute("SELECT COUNT(*) AS n, MIN(at) AS first FROM rate_events WHERE key=?", (key,)).fetchone()
        return int(r["n"]), float(r["first"] or now)

    def add(self, key: str, window: float) -> None:
        from .db import tx
        with tx() as c:
            c.execute("INSERT INTO rate_events (key, at) VALUES (?, ?)", (key, time.time()))

    def reset(self, key: str) -> None:
        from .db import tx
        with tx() as c:
            c.execute("DELETE FROM rate_events WHERE key=?", (key,))

    def clear(self) -> None:
        from .db import tx
        with tx() as c:
            c.execute("DELETE FROM rate_events")


class RedisBackend:
    def __init__(self, url: str) -> None:
        import redis
        self.r = redis.Redis.from_url(url, socket_timeout=2, socket_connect_timeout=2)

    def _k(self, key: str) -> str:
        return f"mt:rl:{key}"

    def count(self, key: str, window: float) -> tuple[int, float]:
        now = time.time()
        k = self._k(key)
        p = self.r.pipeline()
        p.zremrangebyscore(k, 0, now - window)
        p.zcard(k)
        p.zrange(k, 0, 0, withscores=True)
        _, n, first = p.execute()
        return int(n), (first[0][1] if first else now)

    def add(self, key: str, window: float) -> None:
        now = time.time()
        k = self._k(key)
        p = self.r.pipeline()
        p.zadd(k, {f"{now}:{uuid.uuid4().hex[:6]}": now})
        p.expire(k, int(window) + 1)
        p.execute()

    def reset(self, key: str) -> None:
        self.r.delete(self._k(key))

    def clear(self) -> None:
        for k in self.r.scan_iter("mt:rl:*"):
            self.r.delete(k)


class RateLimiter:
    def __init__(self) -> None:
        self._backend: Any = None

    @property
    def backend(self) -> Any:
        if self._backend is None:
            s = get_settings()
            self._backend = (RedisBackend(s.redis_url) if s.redis_url
                             else DatabaseBackend() if s.database_url else MemoryBackend())
        return self._backend

    def check(self, key: str, limit: int, window: float, message: str = "Too many requests") -> None:
        n, first = self.backend.count(key, window)
        if n >= limit:
            retry = max(1, int(window - (time.time() - first)) + 1)
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, f"{message}. Try again in {retry} seconds.",
                                headers={"Retry-After": str(retry)})

    def record(self, key: str, window: float) -> None:
        self.backend.add(key, window)

    def hit(self, key: str, limit: int, window: float, message: str = "Too many requests") -> None:
        """Check and count one event (for throttling expensive endpoints)."""
        self.check(key, limit, window, message)
        self.record(key, window)

    def reset(self, key: str) -> None:
        self.backend.reset(key)

    def clear(self) -> None:
        self.backend.clear()


limiter = RateLimiter()


class LoginGuard:
    """Failed sign-in budget: 5 per account, 50 per client IP (hospitals share NAT), per 5 minutes."""
    WINDOW = 300
    PER_ACCOUNT = 5
    PER_IP = 50

    def check(self, email_key: str, ip_key: str) -> None:
        msg = "Too many failed sign-in attempts"
        limiter.check(email_key, self.PER_ACCOUNT, self.WINDOW, msg)
        limiter.check(ip_key, self.PER_IP, self.WINDOW, msg)

    def fail(self, *keys: str) -> None:
        for k in keys:
            limiter.record(k, self.WINDOW)

    def reset(self, key: str) -> None:
        limiter.reset(key)


login_guard = LoginGuard()
