"""Transcript normalisation: cleanup, de-duplication, same-speaker merging, role mapping."""
import re
from typing import Any

ROLE_LABEL = {"doctor": "Doctor", "student": "Student", "patient": "Patient"}
_WS = re.compile(r"\s+")


def clean_text(text: str) -> str:
    t = _WS.sub(" ", text or "").strip()
    if t and t[0].islower():
        t = t[0].upper() + t[1:]
    return t


def normalize_turns(segments: list[dict[str, Any]], merge_gap_ms: int = 8000) -> list[dict[str, Any]]:
    """Order by offset, drop empty/duplicate segments, merge consecutive segments from the same speaker."""
    turns: list[dict[str, Any]] = []
    for s in sorted(segments, key=lambda x: (x.get("offset_ms") or 0, x.get("created_at") or "")):
        text = clean_text(s.get("text", ""))
        if not text:
            continue
        role = s.get("speaker_role") if s.get("speaker_role") in ROLE_LABEL else "patient"
        prev = turns[-1] if turns else None
        if prev and prev["text"].lower().endswith(text.lower()):
            continue  # duplicate final result
        if (prev and prev["speaker_role"] == role and prev["speaker_name"] == s.get("speaker_name")
                and (s.get("offset_ms") or 0) - prev["end_ms"] <= merge_gap_ms):
            sep = " " if prev["text"].endswith((".", "?", "!")) else ". "
            prev["text"] = prev["text"] + sep + text
            prev["end_ms"] = s.get("offset_ms") or prev["end_ms"]
            continue
        turns.append({
            "speaker_role": role,
            "speaker_name": s.get("speaker_name") or ROLE_LABEL[role],
            "text": text,
            "start_ms": s.get("offset_ms") or 0,
            "end_ms": s.get("offset_ms") or 0,
        })
    return turns


def fmt_ms(ms: int) -> str:
    sec = max(0, int(ms // 1000))
    return f"{sec // 60:02d}:{sec % 60:02d}"


def turns_to_text(turns: list[dict[str, Any]]) -> str:
    return "\n".join(f"[{fmt_ms(t['start_ms'])}] {ROLE_LABEL[t['speaker_role']]} ({t['speaker_name']}): {t['text']}"
                     for t in turns)
