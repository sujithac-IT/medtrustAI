"""Google Meet REST API v2 + Calendar API v3 client.

Auth: OAuth2 refresh token of the hospital's Google Workspace account
(scopes: meetings.space.created, meetings.space.readonly, calendar.events).
"""
import time
import uuid
from typing import Any

import httpx

from ..config import get_settings

MEET = "https://meet.googleapis.com/v2"
CAL = "https://www.googleapis.com/calendar/v3"
_token: dict[str, Any] = {"value": "", "exp": 0.0}


class GoogleNotConfigured(RuntimeError):
    pass


def _access_token() -> str:
    s = get_settings()
    if not s.google_meet_enabled:
        raise GoogleNotConfigured("Google Meet credentials are not configured")
    if _token["value"] and time.time() < _token["exp"] - 60:
        return _token["value"]
    r = httpx.post("https://oauth2.googleapis.com/token", data={
        "client_id": s.google_client_id, "client_secret": s.google_client_secret,
        "refresh_token": s.google_refresh_token, "grant_type": "refresh_token"}, timeout=15)
    r.raise_for_status()
    d = r.json()
    _token.update(value=d["access_token"], exp=time.time() + int(d.get("expires_in", 3600)))
    return _token["value"]


def _req(method: str, url: str, **kw: Any) -> dict[str, Any]:
    r = httpx.request(method, url, headers={"Authorization": f"Bearer {_access_token()}"}, timeout=20, **kw)
    r.raise_for_status()
    return r.json() if r.content else {}


def create_meeting(title: str, start_iso: str, end_iso: str, attendees: list[str]) -> dict[str, Any]:
    """Create a Calendar event with an auto-generated Meet conference, then resolve its Meet space."""
    s = get_settings()
    event = _req("POST", f"{CAL}/calendars/{s.google_calendar_id}/events",
                 params={"conferenceDataVersion": 1, "sendUpdates": "all"},
                 json={"summary": title, "start": {"dateTime": start_iso}, "end": {"dateTime": end_iso},
                       "attendees": [{"email": e} for e in attendees if e],
                       "conferenceData": {"createRequest": {"requestId": uuid.uuid4().hex,
                                                            "conferenceSolutionKey": {"type": "hangoutsMeet"}}}})
    uri = event.get("hangoutLink") or next(
        (e["uri"] for e in event.get("conferenceData", {}).get("entryPoints", []) if e.get("entryPointType") == "video"), "")
    code = uri.rstrip("/").split("/")[-1] if uri else ""
    space: dict[str, Any] = {}
    if code:
        try:
            space = _req("GET", f"{MEET}/spaces/{code}")
        except httpx.HTTPError:
            space = {}
    return {"provider": "google_meet", "meeting_uri": uri, "meeting_code": code,
            "space_name": space.get("name", ""), "calendar_event_id": event.get("id", ""),
            "calendar_html_link": event.get("htmlLink", "")}


def create_space() -> dict[str, Any]:
    sp = _req("POST", f"{MEET}/spaces", json={})
    return {"provider": "google_meet", "meeting_uri": sp.get("meetingUri", ""), "meeting_code": sp.get("meetingCode", ""),
            "space_name": sp.get("name", "")}


def _paged(url: str, key: str, params: dict | None = None) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    params = dict(params or {})
    while True:
        d = _req("GET", url, params=params)
        items += d.get(key, [])
        if not d.get("nextPageToken"):
            return items
        params["pageToken"] = d["nextPageToken"]


def _iso_ms(iso: str) -> float:
    from datetime import datetime
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp() * 1000


def fetch_transcript_entries(space_name: str) -> list[dict[str, Any]]:
    """spaces/{space} -> conferenceRecords -> transcripts -> entries, with participant display names."""
    records = _paged(f"{MEET}/conferenceRecords", "conferenceRecords", {"filter": f'space.name="{space_name}"'})
    out: list[dict[str, Any]] = []
    for rec in records:
        names: dict[str, str] = {}
        for p in _paged(f"{MEET}/{rec['name']}/participants", "participants"):
            u = p.get("signedinUser") or p.get("anonymousUser") or p.get("phoneUser") or {}
            names[p["name"]] = u.get("displayName", "Participant")
        t0 = _iso_ms(rec["startTime"]) if rec.get("startTime") else None
        for tr in _paged(f"{MEET}/{rec['name']}/transcripts", "transcripts"):
            for e in _paged(f"{MEET}/{tr['name']}/entries", "transcriptEntries"):
                start = _iso_ms(e["startTime"]) if e.get("startTime") else 0
                out.append({"entry_id": e["name"], "participant": e.get("participant", ""),
                            "speaker_name": names.get(e.get("participant", ""), "Participant"),
                            "text": e.get("text", ""), "language": e.get("languageCode", "en-US"),
                            "offset_ms": int(start - t0) if t0 else 0})
    return out
