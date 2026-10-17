"""AI guardrails for clinical documentation.

Input side  - transcripts are untrusted: control characters stripped, prompt delimiters neutralised,
              length capped so a huge or adversarial transcript cannot blow the budget.
Output side - every concrete clinical fact the model returns (drug, test, allergy, symptom, history item,
              vital sign, dose) must be traceable to the transcript or the patient record. Unsupported
              items are removed and surfaced under `uncertain_information` for the doctor to verify.
Summaries   - patient-facing text must stay short and must not introduce numbers absent from the sheet.
"""
import re
from typing import Any

MAX_TRANSCRIPT_CHARS = 60_000
MAX_SUMMARY_CHARS = 1_500
_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_WORD = re.compile(r"[a-z0-9]+")
_NUM = re.compile(r"\d+(?:\.\d+)?")
_STOP = {"the", "and", "with", "for", "tab", "tablet", "tablets", "cap", "capsule", "syrup", "inj", "injection",
         "test", "tests", "level", "levels", "mg", "ml", "daily", "once", "twice", "history", "of", "known",
         "drug", "allergy", "to", "a", "an", "in", "on", "at", "by", "or", "no", "chronic", "acute", "mild",
         "severe", "moderate", "left", "right", "pain"}


def sanitize_text(text: str) -> str:
    t = _CTRL.sub(" ", text or "")
    return t.replace('"""', "''' ").replace("```", "'''")


def prepare_transcript(text: str) -> tuple[str, bool]:
    """Returns (safe_text, truncated). Keeps the start and the end (plans are usually stated last)."""
    t = sanitize_text(text)
    if len(t) <= MAX_TRANSCRIPT_CHARS:
        return t, False
    head = t[: MAX_TRANSCRIPT_CHARS // 2]
    tail = t[-MAX_TRANSCRIPT_CHARS // 2:]
    return head + "\n[... middle of transcript omitted for length ...]\n" + tail, True


def _norm(s: str) -> str:
    return " ".join(_WORD.findall((s or "").lower()))


def _key_terms(item: str) -> list[str]:
    return [w for w in _WORD.findall(item.lower()) if len(w) >= 3 and w not in _STOP and not w.isdigit()]


def _supported(item: str, corpus: str, corpus_words: set[str]) -> bool:
    n = _norm(item)
    if not n:
        return True
    if n in corpus:
        return True
    terms = _key_terms(item)
    if not terms:
        return True  # nothing concrete to verify (e.g. "none reported")
    # every key term (or a 5-letter stem of it, for plural/inflection) must appear in the source
    return all(t in corpus_words or any(w.startswith(t[:5]) for w in corpus_words if len(t) >= 6) for t in terms)


def _numbers_supported(value: str, corpus_nums: set[str]) -> bool:
    return all(n in corpus_nums for n in _NUM.findall(value or ""))


def ground_sections(sections: dict[str, Any], transcript: str, record: dict[str, Any]) -> tuple[dict[str, Any], dict]:
    """Remove AI-extracted facts that the transcript/record does not support. Returns (sections, report)."""
    source = transcript + " " + " ".join(str(x) for x in (record.get("allergies") or []) + (record.get("conditions") or []))
    corpus = _norm(source)
    words = set(corpus.split())
    nums = set(_NUM.findall(source))
    removed: list[str] = []
    flagged: list[str] = []

    def keep(label: str, item: str) -> bool:
        ok = _supported(item, corpus, words)
        if not ok:
            removed.append(f"{label}: {item}")
        return ok

    sections["medications"] = [m for m in sections.get("medications", []) if keep("Medication", m.get("name", ""))]
    for m in sections["medications"]:
        dose = " ".join(x for x in (m.get("dose", ""), m.get("frequency", "")) if x)
        if dose and not _numbers_supported(dose, nums):
            flagged.append(f"Dose for {m['name']} ({dose}) was not stated in the transcript")
            m["dose"] = ""
    sections["symptoms"] = [s for s in sections.get("symptoms", []) if keep("Symptom", s.get("name", ""))]
    for key, label in (("investigations", "Investigation"), ("allergies", "Allergy"),
                       ("past_medical_history", "Past history")):
        sections[key] = [x for x in sections.get(key, []) if keep(label, x)]
    vitals = sections.get("doctor_observations", {}).get("vitals", {})
    for k, v in list(vitals.items()):
        if v and not _numbers_supported(v, nums):
            removed.append(f"Vital sign {k.replace('_', ' ')}: {v}")
            vitals[k] = ""
    for key in ("treatment_plan", "follow_up", "assessment"):
        text = sections.get(key, "")
        bad = [n for n in _NUM.findall(text) if n not in nums]
        if bad:
            flagged.append(f"{key.replace('_', ' ').capitalize()} mentions values not found in the transcript: "
                           + ", ".join(sorted(set(bad))[:5]))
    notes = [f"Removed unverified AI suggestion - {r} (not found in the transcript)" for r in removed] + flagged
    if notes:
        sections["uncertain_information"] = list(dict.fromkeys(sections.get("uncertain_information", []) + notes))
    return sections, {"removed": removed, "flagged": flagged}


def check_summary(texts: dict[str, str], sections: dict[str, Any]) -> list[str]:
    """Problems with an AI patient summary; empty list means it may be shown."""
    problems = []
    import json
    sheet_nums = set(_NUM.findall(json.dumps(sections, ensure_ascii=False)))
    for lang, t in texts.items():
        if len(t) > MAX_SUMMARY_CHARS:
            problems.append(f"{lang}: summary too long")
        if re.search(r"<\s*/?\s*[a-z]+[^>]*>", t, re.I):
            problems.append(f"{lang}: contains markup")
    # numbers are language-neutral, so the English text is checked against the sheet
    extra = [n for n in _NUM.findall(texts.get("en", "")) if n not in sheet_nums]
    if extra:
        problems.append("en: introduces values not on the case sheet: " + ", ".join(sorted(set(extra))[:5]))
    return problems
