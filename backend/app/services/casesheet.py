"""17-section case sheet generation.

Primary: Google Gemini structured JSON extraction.
Fallback: deterministic, transcript-grounded extractor. It never invents values: every
item it returns is copied from a transcript sentence or the patient record, and gaps are
reported under `missing_information` instead of being filled with defaults.
"""
import hashlib
import json
import logging
import re
from typing import Any

import httpx

from ..config import get_settings
from .transcript import ROLE_LABEL, turns_to_text

log = logging.getLogger("medtrust.casesheet")

SECTION_KEYS = [
    "patient_info", "chief_complaint", "history_of_present_illness", "symptoms", "duration",
    "past_medical_history", "medications", "allergies", "family_history", "social_history",
    "doctor_observations", "investigations", "assessment", "treatment_plan", "follow_up",
    "missing_information", "uncertain_information",
]
SECTION_TITLES = {
    "patient_info": "Patient Information", "chief_complaint": "Chief Complaint",
    "history_of_present_illness": "History of Present Illness", "symptoms": "Symptoms",
    "duration": "Duration", "past_medical_history": "Past Medical History", "medications": "Medications",
    "allergies": "Allergies", "family_history": "Family History", "social_history": "Social History",
    "doctor_observations": "Doctor Observations", "investigations": "Investigations",
    "assessment": "Assessment", "treatment_plan": "Treatment Plan", "follow_up": "Follow-up",
    "missing_information": "Missing Information", "uncertain_information": "Uncertain Information",
}
LIST_STR = {"past_medical_history", "allergies", "investigations", "missing_information", "uncertain_information"}
TEXT = {"chief_complaint", "history_of_present_illness", "duration", "family_history", "social_history",
        "assessment", "treatment_plan", "follow_up"}
VITAL_KEYS = ["blood_pressure", "pulse", "temperature", "spo2", "respiratory_rate", "weight"]
MED_KEYS = ["name", "dose", "frequency", "route", "duration", "instructions"]
SYM_KEYS = ["name", "severity", "duration", "notes"]


# ---------------------------------------------------------------- normalisation
def _s(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, (list, tuple)):
        return "; ".join(_s(x) for x in v if _s(x))
    if isinstance(v, dict):
        return "; ".join(f"{k}: {_s(x)}" for k, x in v.items() if _s(x))
    return str(v).strip()


def _str_list(v: Any) -> list[str]:
    if v is None:
        return []
    if isinstance(v, str):
        v = [x for x in re.split(r"[\n;]+", v)]
    out: list[str] = []
    for x in v if isinstance(v, list) else [v]:
        t = _s(x)
        if t and t.lower() not in {o.lower() for o in out} and t.lower() not in {"none", "n/a", "nil"}:
            out.append(t)
    return out


def normalize_sections(raw: dict[str, Any], patient_info: dict[str, Any]) -> dict[str, Any]:
    """Coerce any (AI or user) payload into the canonical 17-section shape."""
    raw = raw or {}
    alias = {"hpi": "history_of_present_illness", "follow_up_instructions": "follow_up",
             "assessment_diagnosis": "assessment", "duration_onset": "duration", "observations": "doctor_observations"}
    for a, k in alias.items():
        if a in raw and k not in raw:
            raw[k] = raw[a]
    out: dict[str, Any] = {}
    pi = dict(patient_info)
    if isinstance(raw.get("patient_info"), dict):
        for k, v in raw["patient_info"].items():
            if k not in pi or not pi.get(k):
                pi[k] = v
    out["patient_info"] = pi
    for k in TEXT:
        out[k] = _s(raw.get(k))
    for k in LIST_STR:
        out[k] = _str_list(raw.get(k))
    syms = []
    for s in raw.get("symptoms") or []:
        if isinstance(s, str):
            s = {"name": s}
        if isinstance(s, dict):
            item = {k: _s(s.get(k) or s.get({"name": "symptom"}.get(k, k))) for k in SYM_KEYS}
            if item["name"]:
                syms.append(item)
    out["symptoms"] = syms
    meds = []
    for m in raw.get("medications") or []:
        if isinstance(m, str):
            m = {"name": m}
        if isinstance(m, dict):
            item = {k: _s(m.get(k) or m.get({"name": "drug_name", "dose": "dosage"}.get(k, k))) for k in MED_KEYS}
            if item["name"]:
                meds.append(item)
    out["medications"] = meds
    obs = raw.get("doctor_observations")
    vitals_raw = raw.get("vitals") or (obs.get("vitals") if isinstance(obs, dict) else None) or {}
    summary = obs.get("summary") if isinstance(obs, dict) else obs
    out["doctor_observations"] = {
        "summary": _s(summary),
        "vitals": {k: _s(vitals_raw.get(k)) for k in VITAL_KEYS} if isinstance(vitals_raw, dict)
        else {k: "" for k in VITAL_KEYS},
    }
    return out


def content_hash(sections: dict[str, Any]) -> str:
    return "sha256:" + hashlib.sha256(json.dumps(sections, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


# ---------------------------------------------------------------- Gemini
GEMINI_PROMPT = """You are a clinical scribe for a teaching hospital. Convert the consultation transcript
between a doctor, a medical student and a patient into a structured case sheet.

STRICT RULES
- Use ONLY facts stated in the transcript or the patient record. Never invent vitals, doses, diagnoses or tests.
- If something was not discussed, leave it empty ("" or []) and add a short note to "missing_information".
- Put hedged, contradictory or unclear statements in "uncertain_information".
- Assessment must reflect what the doctor said; if the doctor gave no impression write "".
- Write in concise clinical English even if the transcript is in another language.

Patient record (authoritative demographics):
{record}

Transcript:
\"\"\"
{transcript}
\"\"\"

Return a JSON object with exactly these keys:
{{
 "chief_complaint": "", "history_of_present_illness": "",
 "symptoms": [{{"name": "", "severity": "", "duration": "", "notes": ""}}],
 "duration": "", "past_medical_history": [""],
 "medications": [{{"name": "", "dose": "", "frequency": "", "route": "", "duration": "", "instructions": ""}}],
 "allergies": [""], "family_history": "", "social_history": "",
 "doctor_observations": {{"summary": "", "vitals": {{"blood_pressure": "", "pulse": "", "temperature": "", "spo2": "", "respiratory_rate": "", "weight": ""}}}},
 "investigations": [""], "assessment": "", "treatment_plan": "", "follow_up": "",
 "missing_information": [""], "uncertain_information": [""]
}}"""


def _gemini_json(prompt: str, timeout: float = 45) -> dict[str, Any]:
    s = get_settings()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{s.gemini_model}:generateContent"
    body = {"contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}}
    r = httpx.post(url, params={"key": s.gemini_api_key}, json=body, timeout=timeout)
    r.raise_for_status()
    text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    return json.loads(text)


def extract_with_gemini(turns: list[dict[str, Any]], record: dict[str, Any]) -> dict[str, Any]:
    return _gemini_json(GEMINI_PROMPT.format(record=json.dumps(record, ensure_ascii=False),
                                             transcript=turns_to_text(turns)))


# ---------------------------------------------------------------- local grounded extractor
SYMPTOMS = [
    "chest pain", "chest heaviness", "chest tightness", "heaviness", "breathlessness", "shortness of breath",
    "cough", "dry cough", "fever", "headache", "dizziness", "giddiness", "fatigue", "tiredness", "weakness",
    "nausea", "vomiting", "diarrhea", "diarrhoea", "constipation", "abdominal pain", "stomach pain",
    "burning", "acidity", "heartburn", "bloating", "numbness", "tingling", "palpitations", "swelling",
    "rash", "itching", "sore throat", "cold", "runny nose", "wheezing", "back pain", "joint pain",
    "knee pain", "neck pain", "insomnia", "can't sleep", "anxiety", "worry", "sweating", "weight loss",
    "loss of appetite", "blurred vision", "frequent urination", "burning urination", "chills", "body ache",
    "pain", "sweating", "fainting", "seizure", "bleeding",
]
CONDITIONS = ["diabetes", "hypertension", "high blood pressure", "bp", "asthma", "thyroid", "hypothyroidism",
              "copd", "tuberculosis", "tb", "heart attack", "stroke", "kidney disease", "epilepsy", "cancer",
              "arthritis", "migraine", "cholesterol", "ulcer", "gerd", "depression", "anaemia", "anemia"]
INVESTIGATIONS = ["ecg", "echo", "2d echo", "echocardiogram", "troponin", "cbc", "complete blood count",
                  "hba1c", "blood sugar", "fasting sugar", "x-ray", "xray", "chest x-ray", "ct scan", "ct",
                  "mri", "ultrasound", "usg", "urine test", "urine culture", "lipid profile", "thyroid profile",
                  "tsh", "creatinine", "kidney function", "liver function", "lft", "kft", "rft", "h. pylori",
                  "endoscopy", "blood test", "vitamin b12", "vitamin d", "esr", "crp", "dengue", "malaria",
                  "covid", "spirometry", "biopsy", "stress test", "tmt", "angiogram", "monofilament", "fundus"]
DRUG_SUFFIX = re.compile(
    r"\b([A-Z]?[a-z]{3,}(?:pril|sartan|statin|olol|dipine|formin|gliptin|zole|prazole|cillin|mycin|cycline|"
    r"floxacin|azepam|zepam|pam|xetine|pram|oxetine|triptyline|profen|fenac|mol|amol|lone|sone|tidine|"
    r"setron|mide|thiazide|parin|gabalin|pentin|lukast|terol|sonide|tropium|ide|ine|ate|in))\b(?:\s+(\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|units|iu)))?",
    re.I)
KNOWN_DRUGS = ["paracetamol", "dolo", "crocin", "aspirin", "ecosprin", "metformin", "insulin", "atorvastatin",
               "rosuvastatin", "amlodipine", "telmisartan", "losartan", "enalapril", "ramipril", "metoprolol",
               "pantoprazole", "omeprazole", "esomeprazole", "ranitidine", "ondansetron", "amoxicillin",
               "azithromycin", "cetirizine", "levocetirizine", "montelukast", "salbutamol", "ibuprofen",
               "diclofenac", "glimepiride", "sitagliptin", "pregabalin", "gabapentin", "escitalopram",
               "sertraline", "clonazepam", "levothyroxine", "thyronorm", "sorbitrate", "nitroglycerin",
               "sucralfate", "prednisolone", "vitamin d", "b12", "iron", "calcium", "ors", "doxycycline",
               "ciprofloxacin", "metronidazole", "furosemide", "clopidogrel", "warfarin", "budesonide"]
NOT_DRUGS = {"medicine", "examine", "routine", "morning", "evening", "online", "machine", "engine", "nine",
             "fine", "line", "mine", "shine", "spine", "urine", "vaccine", "intestine", "migraine", "imagine",
             "determine", "outside", "inside", "decide", "aside", "beside", "provide", "side", "guide", "wide",
             "ride", "hide", "tide", "slide", "chloride", "state", "late", "date", "rate", "plate", "create",
             "moderate", "separate", "accurate", "immediate", "ultimate", "climate", "private", "senate",
             "chocolate", "tablet", "within", "begin", "again", "skin", "thin", "pain", "brain", "main",
             "certain", "explain", "contain", "maintain", "remain", "plain", "train", "rain", "gain",
             "vitamin", "protein", "doctor", "medicine", "mention", "position", "nutrition", "condition",
             "insulin", "coin", "join", "margin", "origin", "cabin", "basin", "cousin", "robin", "admin",
             "evaluate", "ultimate", "palpitate", "appropriate", "adequate", "estimate", "tolerate", "indicate",
             "chronic", "routine", "nicotine", "caffeine", "cuisine", "magazine", "quarantine", "examine",
             "pristine", "genuine", "feminine", "medicine", "decline", "airline", "deadline", "online",
             "combine", "define", "refine", "dine", "wine", "pine", "sunshine", "headline", "outline",
             "baseline", "guideline", "timeline", "borderline", "discipline", "ultrasonic", "nearside"}
FREQ = re.compile(r"\b(once|twice|thrice|three times|four times)\s+(?:a|per)?\s*(day|daily|week)|\b(od|bd|bid|tds|tid|qid|"
                  r"sos|hs|daily|at night|at bedtime|bedtime|before breakfast|after food|after meals?|before meals?|"
                  r"in the morning|every \d+ hours|as needed|when needed)\b", re.I)
ROUTE = re.compile(r"\b(oral|by mouth|sublingual|under (?:your|the) tongue|inhaler|injection|iv|im|topical|"
                   r"syrup|suspension|drops|ointment|cream)\b", re.I)
DUR = re.compile(r"\b((?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|few|couple of|several|past|last)"
                 r"\s+(?:days?|weeks?|months?|years?|hours?))\b|\b(since (?:yesterday|morning|last \w+)|"
                 r"(?:yesterday|today|this morning|last night))\b", re.I)
SEVERITY = [("Severe", r"\b(severe|terrible|unbearable|very bad|worst|excruciating|intense|10/10|9/10|8/10)\b"),
            ("Moderate", r"\b(moderate|quite|significant|annoying|bad|non-stop|constant)\b"),
            ("Mild", r"\b(mild|slight|little|a bit|minor|occasional)\b")]
VITALS = {
    "blood_pressure": re.compile(r"\b(?:bp|blood pressure)\D{0,15}(\d{2,3}\s?/\s?\d{2,3})", re.I),
    "pulse": re.compile(r"\b(?:pulse|heart rate|hr)\D{0,15}(\d{2,3})\s*(?:bpm|beats|per minute|/min)?", re.I),
    "temperature": re.compile(r"\b(?:temp(?:erature)?|fever)\D{0,15}(\d{2,3}(?:\.\d)?)\s*(?:°?\s?[fc]|degrees?)", re.I),
    "spo2": re.compile(r"\b(?:spo2|sp o2|oxygen(?: saturation)?|saturation)\D{0,15}(\d{2,3})\s*%?", re.I),
    "respiratory_rate": re.compile(r"\b(?:respiratory rate|rr|breathing rate)\D{0,15}(\d{1,2})", re.I),
    "weight": re.compile(r"\b(?:weight|weigh)\D{0,15}(\d{2,3}(?:\.\d)?)\s*(?:kg|kilos?)", re.I),
}
HEDGE = re.compile(r"\b(maybe|not sure|i think|i guess|probably|might|don'?t remember|can'?t remember|"
                   r"don'?t know|unclear|sometimes|kind of|sort of|perhaps|possibly|i forgot)\b", re.I)


def _sentences(turns: list[dict[str, Any]]) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for t in turns:
        for sent in re.split(r"(?<=[.!?])\s+", t["text"]):
            sent = sent.strip()
            if len(sent) > 2:
                out.append((t["speaker_role"], sent))
    return out


def _has(word: str, text: str) -> bool:
    return re.search(rf"(?<![a-z]){re.escape(word)}(?![a-z])", text, re.I) is not None


def _uniq(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out = []
    for i in items:
        k = i.lower().strip()
        if k and k not in seen:
            seen.add(k)
            out.append(i.strip())
    return out


def extract_locally(turns: list[dict[str, Any]], record: dict[str, Any]) -> dict[str, Any]:
    sents = _sentences(turns)
    pat = [s for r, s in sents if r == "patient"]
    clin = [s for r, s in sents if r in ("doctor", "student")]
    doc = [s for r, s in sents if r == "doctor"] or clin
    pat_q = [s for s in pat if not s.endswith("?")]

    # Symptoms: most specific term per sentence
    symptoms: list[dict[str, str]] = []
    seen_sym: set[str] = set()
    for s in pat_q:
        for term in sorted(SYMPTOMS, key=len, reverse=True):
            if _has(term, s) and not any(term in x for x in seen_sym) and re.search(r"\b(no|not|never|without)\s+(\w+\s+){0,2}" + re.escape(term), s, re.I) is None:
                seen_sym.add(term)
                d = DUR.search(s)
                sev = next((lvl for lvl, rx in SEVERITY if re.search(rx, s, re.I)), "")
                symptoms.append({"name": term.capitalize(), "severity": sev, "duration": d.group(0) if d else "",
                                 "notes": s})
                break
    chief = ""
    for s in pat_q:
        if any(_has(t, s) for t in SYMPTOMS):
            chief = s
            break
    hpi_s = [s for s in pat_q if any(_has(t, s) for t in SYMPTOMS) or DUR.search(s)]
    durations = _uniq([m.group(0) for s in pat_q for m in DUR.finditer(s)])

    # History
    pmh = list(record.get("conditions") or [])
    for s in pat_q:
        low = s.lower()
        if re.search(r"\b(family|father|mother|brother|sister|parents?|grand\w+)\b", low):
            continue
        for c in CONDITIONS:
            if _has(c, s) and re.search(r"\b(have|had|history|diagnosed|suffer|known|taking .* for|since)\b", low):
                pmh.append(c.upper() if len(c) <= 4 else c.capitalize())
    allergies = list(record.get("allergies") or [])
    for s, src in [(s, "t") for _, s in sents]:
        m = re.search(r"allerg(?:ic|y)\s+(?:to\s+)?([A-Za-z0-9 \-]+?)(?:[.,;]|$| and | but )", s, re.I)
        if m and not re.search(r"\bno (known )?allerg", s, re.I):
            allergies.append(m.group(1).strip().capitalize())
    if any(re.search(r"\bno (known )?(drug )?allerg", s, re.I) for _, s in sents) and not allergies:
        allergies = ["No known allergies (patient reported)"]
    fam = [s for _, s in sents if re.search(r"\b(family|father|mother|brother|sister|parents|grandfather|grandmother)\b", s, re.I)
           and not s.endswith("?")]
    social = [s for s in pat_q if re.search(r"\b(smok\w*|cigarette|alcohol|drink\w*|beer|tobacco|gutka|work as|"
                                            r"job|occupation|exercise|walk\w*|diet|vegetarian|married|live with|stress)\b", s, re.I)]

    # Medications
    meds: dict[str, dict[str, str]] = {}
    for role, s in sents:
        found: list[tuple[str, str]] = []
        for d in KNOWN_DRUGS:
            if _has(d, s):
                dm = re.search(rf"{re.escape(d)}\s+(\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|units|iu))", s, re.I)
                found.append((d, dm.group(1) if dm else ""))
        for m in DRUG_SUFFIX.finditer(s):
            w = m.group(1).lower()
            if m.group(2) and w not in NOT_DRUGS and not any(w == f[0] for f in found):
                found.append((w, m.group(2)))
        for name, dose in found:
            key = name.lower()
            item = meds.setdefault(key, {"name": name.title() if len(name) > 3 else name.upper(), "dose": "",
                                         "frequency": "", "route": "", "duration": "", "instructions": ""})
            item["dose"] = item["dose"] or dose
            f = FREQ.search(s)
            if f and not item["frequency"]:
                item["frequency"] = f.group(0)
            r = ROUTE.search(s)
            if r and not item["route"]:
                item["route"] = r.group(0)
            if re.search(rf"\b(stop|discontinue|stopping)\b[^.]*{re.escape(name)}", s, re.I):
                item["instructions"] = "Discontinue (as advised in consultation)"
            elif role in ("doctor", "student") and not item["instructions"]:
                item["instructions"] = s[:200]

    # Doctor findings
    vitals = {k: "" for k in VITAL_KEYS}
    for _, s in sents:
        for k, rx in VITALS.items():
            m = rx.search(s)
            if m and not vitals[k]:
                unit = {"blood_pressure": " mmHg", "pulse": " bpm", "spo2": "%", "respiratory_rate": " /min",
                        "weight": " kg"}.get(k, "")
                vitals[k] = m.group(1).replace(" ", "") + unit
    obs = [s for s in clin if re.search(r"\b(on examination|i can see|looks|appears|tender|swollen|normal|"
                                       r"auscultat|chest is clear|reflex|pupil|throat is|abdomen is|"
                                       r"blood pressure|bp is|pulse|spo2|temperature)\b", s, re.I) and not s.endswith("?")]
    inv = []
    for _, s in [x for x in sents if x[0] in ("doctor", "student")]:
        for t in sorted(INVESTIGATIONS, key=len, reverse=True):
            if _has(t, s) and not any(t in i.lower() for i in inv):
                inv.append(t.upper() if len(t) <= 5 else t.title())
    assess = [s for s in doc if re.search(r"\b(diagnos\w*|likely|suspect\w*|impression|consistent with|"
                                         r"rule out|probably|looks like|seems like|this is|you have|known to cause|"
                                         r"suggest\w*)\b", s, re.I) and not s.endswith("?")]
    plan = [s for s in clin if re.search(r"\b(prescrib\w*|take|start\w*|stop\w*|switch\w*|continue|avoid|"
                                        r"diet|exercise|tablet|medicine|dose|increase|reduce|add\w*|refer\w*|"
                                        r"therapy|rest|drink|practice)\b", s, re.I) and not s.endswith("?")]
    follow = [s for s in clin if re.search(r"\b(follow[- ]?up|review|come back|see you|revisit|next visit|"
                                          r"after \w+ (days|weeks)|emergency|call 108|immediately|if the|if you)\b",
                                          s, re.I) and not s.endswith("?")]
    uncertain = [s for s in pat if HEDGE.search(s)]

    sections: dict[str, Any] = {
        "chief_complaint": chief,
        "history_of_present_illness": " ".join(hpi_s[:6]),
        "symptoms": symptoms,
        "duration": "; ".join(durations),
        "past_medical_history": _uniq(pmh),
        "medications": list(meds.values()),
        "allergies": _uniq(allergies),
        "family_history": " ".join(fam[:3]),
        "social_history": " ".join(social[:3]),
        "doctor_observations": {"summary": " ".join(obs[:4]), "vitals": vitals},
        "investigations": inv,
        "assessment": " ".join(_uniq(assess)[:3]),
        "treatment_plan": "\n".join(f"- {s}" for s in _uniq(plan)[:8]),
        "follow_up": " ".join(_uniq(follow)[:3]),
        "uncertain_information": _uniq(uncertain)[:6],
    }
    missing = []
    checks = [("chief_complaint", "Chief complaint not clearly stated"),
              ("duration", "Duration / onset of symptoms not documented"),
              ("allergies", "Allergy history not asked"),
              ("past_medical_history", "Past medical history not discussed"),
              ("family_history", "Family history not discussed"),
              ("social_history", "Social history (smoking, alcohol, occupation) not discussed"),
              ("medications", "Current medications not reviewed"),
              ("assessment", "No clinical impression stated by the doctor"),
              ("follow_up", "Follow-up plan not specified")]
    for k, msg in checks:
        if not sections[k]:
            missing.append(msg)
    if not any(vitals.values()):
        missing.append("Vital signs not recorded during the teleconsultation")
    sections["missing_information"] = missing
    return sections


# ---------------------------------------------------------------- orchestration
def record_for(patient: dict[str, Any], doctor: dict[str, Any], student: dict[str, Any] | None,
               consultation: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": f"{patient['first_name']} {patient['last_name']}",
        "mrn": patient["mrn"], "age": patient.get("age"), "gender": patient["gender"],
        "date_of_birth": patient["date_of_birth"], "blood_group": patient.get("blood_group") or "",
        "phone": patient["phone"], "consultation_date": (consultation.get("started_at") or consultation["scheduled_at"])[:10],
        "attending_doctor": doctor["name"], "doctor_registration": doctor.get("registration_number") or "",
        "student": student["name"] if student else "", "reason_for_visit": consultation.get("reason") or "",
        "allergies": patient.get("allergies", []), "conditions": patient.get("conditions", []),
    }


def generate(turns: list[dict[str, Any]], record: dict[str, Any]) -> tuple[dict[str, Any], str]:
    info = {k: record[k] for k in ("name", "mrn", "age", "gender", "date_of_birth", "blood_group", "phone",
                                   "consultation_date", "attending_doctor", "doctor_registration", "student",
                                   "reason_for_visit")}
    if get_settings().gemini_enabled and turns:
        try:
            return normalize_sections(extract_with_gemini(turns, record), info), "gemini"
        except Exception as e:  # network, quota, malformed JSON
            log.warning("Gemini extraction failed, using local extractor: %s", type(e).__name__)
    return normalize_sections(extract_locally(turns, record), info), "local"


# ---------------------------------------------------------------- multilingual summary
LANGS = {"en": "English", "ta": "Tamil", "hi": "Hindi", "te": "Telugu", "ml": "Malayalam", "kn": "Kannada"}
LABELS = {
    "en": ("Your consultation summary", "Problem", "Doctor's assessment", "Medicines", "Tests", "Next steps"),
    "ta": ("உங்கள் ஆலோசனை சுருக்கம்", "பிரச்சனை", "மருத்துவரின் மதிப்பீடு", "மருந்துகள்", "பரிசோதனைகள்", "அடுத்த நடவடிக்கைகள்"),
    "hi": ("आपके परामर्श का सारांश", "समस्या", "डॉक्टर का आकलन", "दवाइयाँ", "जाँचें", "आगे के कदम"),
    "te": ("మీ సంప్రదింపు సారాంశం", "సమస్య", "వైద్యుని అంచనా", "మందులు", "పరీక్షలు", "తదుపరి చర్యలు"),
    "ml": ("നിങ്ങളുടെ കൺസൾട്ടേഷൻ സംഗ്രഹം", "പ്രശ്നം", "ഡോക്ടറുടെ വിലയിരുത്തൽ", "മരുന്നുകൾ", "പരിശോധനകൾ", "അടുത്ത നടപടികൾ"),
    "kn": ("ನಿಮ್ಮ ಸಮಾಲೋಚನೆಯ ಸಾರಾಂಶ", "ಸಮಸ್ಯೆ", "ವೈದ್ಯರ ಮೌಲ್ಯಮಾಪನ", "ಔಷಧಿಗಳು", "ಪರೀಕ್ಷೆಗಳು", "ಮುಂದಿನ ಹಂತಗಳು"),
}


def _english_summary(sec: dict[str, Any]) -> list[tuple[int, str]]:
    meds = "; ".join(" ".join(x for x in (m["name"], m["dose"], m["frequency"]) if x) for m in sec["medications"])
    parts = [(1, sec["chief_complaint"]), (2, sec["assessment"]), (3, meds),
             (4, ", ".join(sec["investigations"])), (5, sec["follow_up"])]
    return [(i, t) for i, t in parts if t]


def summaries(sec: dict[str, Any]) -> dict[str, Any]:
    """Patient-friendly summary in 6 languages. Gemini translates when available; otherwise localized
    headings with English clinical content (flagged machine_translated=False)."""
    s = get_settings()
    if s.gemini_enabled:
        try:
            prompt = ("Write a short, plain-language summary (max 120 words) of this approved case sheet for the "
                      "patient, then translate it. Use only the facts given. Return JSON with keys "
                      + ", ".join(LANGS) + " each a string.\n" + json.dumps(
                          {k: sec[k] for k in ("chief_complaint", "assessment", "medications", "investigations",
                                               "treatment_plan", "follow_up")}, ensure_ascii=False))
            data = _gemini_json(prompt)
            if all(isinstance(data.get(k), str) and data[k].strip() for k in LANGS):
                return {"machine_translated": True, "source": "gemini", "texts": {k: data[k].strip() for k in LANGS}}
        except Exception as e:
            log.warning("Gemini summary failed: %s", type(e).__name__)
    body = _english_summary(sec)
    texts = {}
    for code, lab in LABELS.items():
        lines = [lab[0] + ":"] + [f"{lab[i]}: {t}" for i, t in body]
        texts[code] = "\n".join(lines) if body else lab[0] + ": -"
    return {"machine_translated": False, "source": "template", "texts": texts}
