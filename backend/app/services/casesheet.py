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
SYMPTOM_PATTERNS: list[tuple[str, str]] = [
    ("Chest heaviness", r"chest heaviness|heaviness in (?:the )?(?:cent(?:er|re) of )?(?:my |the |his |her )?chest"),
    ("Chest tightness", r"chest tightness|tight(?:ness in)? (?:my |the )?chest"),
    ("Chest pain", r"chest pain|pain in (?:my |the )?chest"),
    ("Breathlessness", r"breathless(?:ness)?|shortness of breath|short of breath|difficulty (?:in )?breathing"),
    ("Dry cough", r"dry (?:\w+ ){0,2}cough"),
    ("Cough", r"cough(?:ing)?"),
    ("Wheezing", r"wheez\w*|whistling sound"),
    ("Fever", r"fever|feverish"),
    ("Headache", r"headaches?"),
    ("Dizziness", r"dizz\w+|giddi\w+|light-?headed\w*"),
    ("Fatigue", r"fatigue|tiredness|always tired|weakness"),
    ("Nausea", r"nause\w+"),
    ("Vomiting", r"vomit\w*"),
    ("Diarrhoea", r"diarrh\w+|loose stools?|loose motions?"),
    ("Constipation", r"constipat\w+"),
    ("Abdominal pain", r"abdominal (?:pain|discomfort)|stomach (?:pain|ache)|pain (?:right )?below (?:my |the )?breastbone|epigastric pain"),
    ("Burning pain", r"burning(?: and [\w\-]+)? (?:\w+ ){0,2}pain|burning sensation"),
    ("Heartburn / regurgitation", r"heartburn|acid(?:ity| reflux)|sour liquid|regurgitat\w*"),
    ("Tingling / prickling", r"tingl\w*|prickl\w*|pins and needles|needle-like"),
    ("Numbness", r"numb(?:ness)?"),
    ("Palpitations", r"palpitations?|heart (?:races|racing|pounding|is racing)|racing heart"),
    ("Sweating", r"sweat(?:s|ing|y)?|diaphoresis"),
    ("Tremors", r"tremors?|shaky hands|hands shak\w+"),
    ("Insomnia", r"insomnia|can'?t sleep|cannot sleep|stay awake|trouble sleeping|difficulty sleeping|unable to sleep"),
    ("Anxiety", r"anxi(?:ety|ous)|dread|mind won'?t stop racing|racing thoughts"),
    ("Swelling", r"swell\w*|swollen"),
    ("Rash / itching", r"rash(?:es)?|itch\w*"),
    ("Sore throat", r"sore throat|throat pain"),
    ("Runny nose", r"runny nose|blocked nose|sneez\w+"),
    ("Back pain", r"back (?:pain|ache|strain)|backache"),
    ("Joint pain", r"joint pains?|knee pain|arthralgia"),
    ("Neck pain", r"neck pain"),
    ("Weight loss", r"weight loss|losing weight|lost weight"),
    ("Loss of appetite", r"loss of appetite|not hungry|poor appetite"),
    ("Blurred vision", r"blurr\w+ vision|vision is blurr\w+"),
    ("Frequent urination", r"frequent urination|urinat\w+ frequently|passing urine frequently"),
    ("Burning urination", r"burning (?:while |during )?urination|pain(?:ful)? (?:while |during )?urinat\w+"),
    ("Chills", r"chills|rigors"),
    ("Body ache", r"body ache|body pain|myalgia"),
    ("Fainting", r"faint\w*|passed out|syncope|blackout"),
    ("Seizure", r"seizures?|fits|convulsions?"),
    ("Bleeding", r"bleed\w*|blood in (?:my |the )?\w+"),
    ("Pain", r"pain"),
]
_SYM_RX = [(n, re.compile(rf"(?<![\w-])(?:{p})(?![\w])", re.I)) for n, p in SYMPTOM_PATTERNS]
CONDITIONS = {"diabetes": "Diabetes mellitus", "hypertension": "Hypertension", "high blood pressure": "Hypertension",
              "bp": "Hypertension", "asthma": "Asthma", "thyroid": "Thyroid disorder", "hypothyroidism": "Hypothyroidism",
              "copd": "COPD", "tuberculosis": "Tuberculosis", "tb": "Tuberculosis", "heart attack": "Myocardial infarction",
              "stroke": "Stroke", "kidney disease": "Chronic kidney disease", "epilepsy": "Epilepsy", "cancer": "Cancer",
              "arthritis": "Arthritis", "migraine": "Migraine", "cholesterol": "Dyslipidaemia", "ulcer": "Peptic ulcer",
              "gerd": "GERD", "depression": "Depression", "anaemia": "Anaemia", "anemia": "Anaemia",
              "eczema": "Eczema", "skin allergy": "Skin allergy"}
INVESTIGATIONS = ["12-lead ecg", "ecg", "2d echo", "echocardiogram", "echo", "cardiac troponin", "troponin",
                  "complete blood count", "cbc", "hba1c", "fasting blood sugar", "blood sugar", "x-ray", "chest x-ray",
                  "ct scan", "mri", "ultrasound", "usg", "urine microalbumin-creatinine ratio", "urine microalbumin",
                  "urine culture", "urine test", "lipid profile", "thyroid profile", "tsh", "serum creatinine",
                  "creatinine", "kidney function test", "liver function test", "lft", "kft", "rft",
                  "h. pylori stool antigen test", "h. pylori", "upper gi endoscopy", "endoscopy", "blood test",
                  "vitamin b12", "vitamin d", "esr", "crp", "dengue", "malaria", "covid", "spirometry",
                  "peak flow", "biopsy", "stress test", "tmt", "angiogram", "monofilament test",
                  "dilated fundus eye examination", "fundus examination", "fundus"]
DRUG_SUFFIX = re.compile(
    r"\b([A-Z][a-z]{3,}(?:pril|sartan|statin|olol|dipine|formin|gliptin|prazole|cillin|mycin|cycline|floxacin|"
    r"azepam|xetine|opram|triptyline|profen|fenac|tidine|setron|thiazide|parin|gabalin|pentin|lukast|terol|"
    r"sonide|tropium|semide|glitazone|gliflozin|mide))\b")
KNOWN_DRUGS = ["paracetamol", "dolo", "crocin", "aspirin", "ecosprin", "metformin", "insulin", "atorvastatin",
               "rosuvastatin", "amlodipine", "telmisartan", "losartan", "enalapril", "ramipril", "metoprolol",
               "pantoprazole", "omeprazole", "esomeprazole", "ranitidine", "ondansetron", "amoxicillin",
               "azithromycin", "cetirizine", "levocetirizine", "montelukast", "salbutamol", "ibuprofen",
               "diclofenac", "glimepiride", "sitagliptin", "pregabalin", "gabapentin", "escitalopram",
               "sertraline", "clonazepam", "levothyroxine", "thyronorm", "sorbitrate", "nitroglycerin",
               "sucralfate", "prednisolone", "doxycycline", "ciprofloxacin", "metronidazole", "furosemide",
               "clopidogrel", "warfarin", "budesonide", "ors", "vitamin d3", "folic acid"]
DOSE = r"\d+(?:\.\d+)?\s?(?:mg|mcg|µg|g|ml|units|iu)\b"
FREQ = re.compile(r"\b(?:(?:once|twice|thrice|three times|four times)\s+(?:a\s+|per\s+)?(?:day|daily|week|weekly)|"
                  r"\d+ puffs?(?: \w+){0,2} as needed|od|bd|bid|tds|tid|qid|sos|daily|every \d+ hours|as needed|"
                  r"when needed|at night|at bedtime|in the morning|in the evening)\b", re.I)
ROUTE = re.compile(r"\b(oral|by mouth|sublingual|under (?:your|the) tongue|metered-dose inhaler|inhaler|injection|"
                   r"intravenous|topical|syrup|oral suspension|suspension|drops|ointment|cream|patch)\b", re.I)
TIMING = re.compile(r"\b(?:\d+ minutes )?(?:before|after|with) (?:breakfast|lunch|dinner|meals?|food)\b|"
                    r"\bunder (?:your|the) tongue\b|\bwith a spacer[\w ,\-]*?(?=,|$)|\bgradually titrating to " + DOSE +
                    r"|\bshort-term\b|\bfor acute [a-z ]+?(?=[.,]|$)|\bto coat [a-z ]+?(?=[.,]|$)|\bwithout any antacid\b",
                    re.I)
MED_DURATION = re.compile(r"\bfor (?:almost |about |around |the next )?((?:\d+|one|two|three|four|five|six|seven|"
                          r"eight|nine|ten|few)(?:-\d+)?\s+(?:days?|weeks?|months?|nights?))", re.I)
DUR = re.compile(r"\b(?:(?:for|since) )?(?:the )?(?:(?:past|last|almost|about) )?(?:\d+|one|two|three|four|five|six|"
                 r"seven|eight|nine|ten|few|couple of|several)\s+(?:days?|weeks?|months?|years?)(?: and a half)?\b|"
                 r"\b(?:for |since )?(?:the )?(?:past|last) (?:day|week|month|year)(?: and a half)?\b|"
                 r"\bsince (?:yesterday|this morning|last night|last \w+)\b", re.I)
SEVERITY = [("Severe", r"\b(severe|terrible|unbearable|very bad|worst|excruciating|intense|relentless|10/10|9/10|8/10)\b"),
            ("Moderate", r"\b(moderate|quite|significant|annoying|non-stop|constant)\b"),
            ("Mild", r"\b(mild|slight|a little|a bit|minor|occasional)\b")]
VITALS = {
    "blood_pressure": re.compile(r"\b(?:bp|blood pressure)\D{0,15}(\d{2,3}\s?/\s?\d{2,3})", re.I),
    "pulse": re.compile(r"\b(?:pulse|heart rate|hr)\D{0,15}(\d{2,3})\s*(?:bpm|beats|per minute|/min)", re.I),
    "temperature": re.compile(r"\b(?:temp(?:erature)?)\D{0,20}?(\d{2,3}(?:\.\d)?)\s*(°?\s?[fc]\b|degrees?)", re.I),
    "spo2": re.compile(r"\b(?:spo2|sp o2|oxygen(?: saturation)?|saturation)\D{0,15}(\d{2,3})\s*%", re.I),
    "respiratory_rate": re.compile(r"\b(?:respiratory rate|breathing rate)\D{0,15}(\d{1,2})", re.I),
    "weight": re.compile(r"\b(?:weight|weigh|weighs)\D{0,15}(\d{2,3}(?:\.\d)?)\s*(?:kg|kilos?)", re.I),
}
HEDGE = re.compile(r"\b(maybe|not sure|i think|i guess|probably|might have|don'?t remember|can'?t remember|"
                   r"don'?t know|unclear|kind of|sort of|perhaps|possibly|i forgot)\b", re.I)
NEGATION = re.compile(r"\b(no|not|never|without|denies|denied|nor|any)\b(?:\s+[\w\-]+){0,3}\s*$", re.I)
AGREE = re.compile(r"^\W*(exactly|agreed|agree|spot on|good assessment|correct|right|yes|well done|very good|"
                   r"excellent|that'?s right|absolutely)\b", re.I)
ABBREV = re.compile(r"(?:\b(?:Mr|Mrs|Ms|Dr|Prof|St|vs|No|approx)|\b[A-Z])\.$")
GREETING = re.compile(r"^(?:(?:good (?:morning|afternoon|evening)|hello|hi|hey|vanakkam|namaste|namaskar|ok(?:ay)?|so|"
                      r"well|but|and|also|thank you|thanks)\b[,!.]?\s*)+", re.I)
DROP = re.compile(r"^(?:good (?:morning|afternoon|evening)|hello|hi|vanakkam|namaste|thank you(?: so much)?|thanks|"
                  r"understood|ok(?:ay)?|yes|no|sure|exactly right|exactly|agreed|spot on|good assessment|not at all|"
                  r"yes,? absolutely|right)\W*$", re.I)
ASSESS = re.compile(r"\b(diagnos\w*|likely|suspect\w*|impression|consistent with|rule out|probably|looks like|"
                    r"seems like|indicat\w*|classic for|criteria for|known to cause|leading to|suggest\w*|"
                    r"suboptimal|due to|secondary to|induced)\b", re.I)
PLAN = re.compile(r"\b(prescrib\w*|take|start\w*|stop\w*|switch\w*|continue|avoid|diet|exercise|tablet|dose|"
                  r"increase|reduce|add|refer\w*|therapy|rest|practi[cs]e|inspect|monitor|keep|connect|initiate|"
                  r"give|inhaler|puffs?|hygiene|intensify|titrat\w*)\b", re.I)
FOLLOW = re.compile(r"\b(follow[- ]?up|review (?:in|after)|come back|see you|revisit|next visit|after \d+ (?:days|weeks)|"
                    r"emergency|call 108|108 ambulance|if (?:the|you|symptoms|he|she|it|pain|there)\b|if [A-Z][a-z]+ "
                    r"(?:shows|has|develops|gets))", re.I)
ORDER = re.compile(r"\b(get|do|need|order\w*|perform|send|check|test|screen\w*|let'?s|investigat\w*|advise\w*)\b", re.I)
WORDNUM = {"one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"}


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    out: list[str] = []
    for p in parts:
        if out and ABBREV.search(out[-1]):
            out[-1] += " " + p
        else:
            out.append(p)
    return [p.strip() for p in out if len(p.strip()) > 1]


def _names(turns: list[dict[str, Any]], record: dict[str, Any]) -> list[str]:
    """Personal names used as vocatives ("Lakshmi, we need...", "...doctor, Sneha.") so they can be stripped."""
    stop = {"dr", "md", "mbbs", "patient", "consultant", "intern", "father", "mother", "of", "the", "and", "student",
            "doctor", "prof", "mr", "mrs", "ms", "sir", "madam"}
    raw = " ".join(str(record.get(k) or "") for k in ("name", "attending_doctor", "student"))
    raw += " " + " ".join(t.get("speaker_name") or "" for t in turns)
    names = {w for w in re.findall(r"[A-Za-z][a-z]+", raw) if w.lower() not in stop and len(w) > 2}
    return sorted(names, key=len, reverse=True)


def _clean(sent: str, names: list[str]) -> str:
    s = sent.strip()
    name_rx = "|".join(re.escape(n) for n in names) or r"(?!x)x"
    title = r"(?:(?:Mr|Mrs|Ms|Dr|Prof)\.?\s+)?"
    for _ in range(3):
        s = GREETING.sub("", s)
        s = re.sub(rf"^{title}(?:{name_rx})(?:\s+(?:{name_rx}))?\s*[,!.:]\s*", "", s)
        s = re.sub(r"^(?:doctor|sir|madam)\s*[,!.]\s*", "", s, flags=re.I)
    s = re.sub(rf"^{title}(?:{name_rx}) here\W*$", "", s)
    s = re.sub(rf",\s*{title}(?:{name_rx})(?:\s+(?:{name_rx}))?(?=\s*[.!?]?$)", "", s)
    s = re.sub(r",?\s+\b(?:doctor|sir|madam)\b(?=\s*[,.!?]|$)", "", s, flags=re.I)
    s = re.sub(r"\s{2,}", " ", s).strip(" ,")
    if s and not s.endswith((".", "!", "?")):
        s += "."
    return s[:1].upper() + s[1:] if s else s


def _sentences(turns: list[dict[str, Any]], names: list[str] | None = None) -> list[dict[str, Any]]:
    names = names or []
    out: list[dict[str, Any]] = []
    for ti, t in enumerate(turns):
        for raw in _split_sentences(t["text"]):
            clean = _clean(raw, names)
            if not clean or DROP.match(clean) or len(clean.split()) < 2:
                clean = ""
            out.append({"role": t["speaker_role"], "raw": raw, "text": clean, "turn": ti,
                        "question": raw.rstrip().endswith("?")})
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


def _clause(sent: str, start: int, end: int) -> str:
    """The comma/'but'-delimited clause of `sent` that contains [start, end)."""
    bounds = [0] + [m.end() for m in re.finditer(r",\s*|;\s*|\s+but\s+|\s+—\s+", sent)] + [len(sent) + 1]
    lo = max(b for b in bounds if b <= start)
    hi = min((m.start() for m in re.finditer(r",|;|\s+but\s+|\s+—\s+", sent) if m.start() >= end), default=len(sent))
    c = sent[lo:hi].strip(" .")
    c = re.sub(r"^(?:and|but|also|so)\s+", "", c, flags=re.I)
    return c[:1].upper() + c[1:]


def _duration_phrase(text: str) -> str:
    m = DUR.search(text)
    if not m:
        return ""
    d = re.sub(r"^(?:for|since)\s+", "", m.group(0), flags=re.I)
    return re.sub(r"^the\s+", "", d, flags=re.I)


def _sentence_symptoms(text: str) -> list[tuple[str, re.Match]]:
    found: list[tuple[str, re.Match]] = []
    taken: list[tuple[int, int]] = []
    for name, rx in _SYM_RX:
        for m in rx.finditer(text):
            if any(a < m.end() and m.start() < b for a, b in taken):
                continue
            if name == "Pain" and found:
                continue
            clause_pre = text[max(0, m.start() - 40):m.start()]
            clause_pre = re.split(r"[,;]|\bbut\b", clause_pre)[-1]
            if NEGATION.search(clause_pre):
                taken.append((m.start(), m.end()))
                continue
            taken.append((m.start(), m.end()))
            found.append((name, m))
            break
    return sorted(found, key=lambda x: x[1].start())


def _join_names(names: list[str]) -> str:
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


def _find_drugs(text: str) -> list[tuple[str, int, int]]:
    hits: list[tuple[str, int, int]] = []
    for d in KNOWN_DRUGS:
        for m in re.finditer(rf"(?<![A-Za-z]){re.escape(d)}(?![A-Za-z])", text, re.I):
            hits.append((d, m.start(), m.end()))
    for m in DRUG_SUFFIX.finditer(text):
        w = m.group(1).lower()
        if not any(h[1] <= m.start() < h[2] for h in hits) and re.match(rf"\s*(?:\w+\s+){{0,3}}?{DOSE}", text[m.end():], re.I):
            hits.append((w, m.start(), m.end()))
    hits.sort(key=lambda h: h[1])
    return hits


def _medications(sents: list[dict[str, Any]]) -> list[dict[str, str]]:
    meds: dict[str, dict[str, Any]] = {}
    for idx, st in enumerate(sents):
        raw, role = st["raw"], st["role"]
        if st["question"]:
            continue
        text = _clean(raw, []) or raw
        drugs = _find_drugs(text)
        prev_verb = ""
        for i, (name, a, b) in enumerate(drugs):
            pre = text[(drugs[i - 1][2] if i else 0):a]
            post = text[b:(drugs[i + 1][1] if i + 1 < len(drugs) else len(text))]
            verbs = re.findall(r"\b(stop(?:ping)? taking|stop|discontinue|hold|increase|reduce|decrease|switch to|"
                               r"prescrib\w*|start\w*|add|take|give|initiate|begin|continue|taking|using|popping|"
                               r"been on|started me on|on)\b", pre, re.I)
            verb = verbs[-1].lower() if verbs else (prev_verb if i and len(pre) < 60 and "." not in pre.strip(" .") else "")
            prev_verb = verb
            item = meds.setdefault(name.lower(), {"name": name.title() if len(name) > 3 else name.upper(),
                                                   "dose": "", "frequency": "", "route": "", "duration": "",
                                                   "notes": [], "status": "", "prev": ""})
            dm = re.match(rf"\s*(?:to\s+)?(?:[\w\-]+\s+){{0,3}}?({DOSE})", post, re.I)
            fm, rm, du = FREQ.search(post), ROUTE.search(pre[-25:] + " " + post), MED_DURATION.search(post)
            stopping = re.match(r"stop|discontinue|hold", verb)
            changing = re.match(r"increase|reduce|decrease", verb)
            clinician = role in ("doctor", "student")
            if clinician and role == "doctor" and stopping:
                item["status"] = "stopped"
            elif clinician and changing:
                if item["dose"] or item["frequency"]:
                    item["prev"] = " ".join(x for x in (item["dose"], item["frequency"]) if x)
                item["status"] = "changed"
                item["dose"], item["frequency"] = (dm.group(1) if dm else item["dose"]), (fm.group(0) if fm else item["frequency"])
            elif clinician and role == "doctor" and verb and not re.match(r"taking|using|popping|been on|on$", verb):
                item["status"] = item["status"] if item["status"] in ("changed",) else (
                    "continued" if verb == "continue" else "prescribed")
            elif role == "patient" and verb:
                item["status"] = item["status"] or "current"
            elif not item["status"] and role == "patient":
                item["status"] = "mentioned"
            if not stopping and not changing:
                if dm and not (item["status"] == "stopped" and item["dose"]):
                    item["dose"] = item["dose"] if item["status"] == "changed" else dm.group(1)
                if fm and not item["frequency"]:
                    item["frequency"] = fm.group(0)
            if rm and not item["route"]:
                r = rm.group(0).lower()
                item["route"] = "Sublingual" if "tongue" in r else r.capitalize()
            if du and not item["duration"] and not stopping:
                item["duration"] = du.group(1)
            if role == "doctor" and not stopping:
                for t in TIMING.finditer(post):
                    item["notes"].append(t.group(0).strip(" ,"))
                purpose = re.match(r"^\s*((?:for|to) [^,]{4,80}),", text)
                if purpose and purpose.end() <= a and len(drugs) == 1:
                    item["notes"].append(purpose.group(1)[:1].upper() + purpose.group(1)[1:])
                # Administration advice in the next doctor sentence ("Keep one tablet under your tongue.")
                nxt = sents[idx + 1] if idx + 1 < len(sents) else None
                if (len(drugs) == 1 and nxt and nxt["role"] == "doctor" and nxt["turn"] == st["turn"]
                        and not _find_drugs(nxt["raw"]) and re.search(r"\b(tablet|puffs?|under your tongue|dose)\b",
                                                                      nxt["raw"], re.I)
                        and not FOLLOW.search(nxt["raw"])):
                    item["notes"].append(nxt["text"].rstrip("."))
                    if "tongue" in nxt["raw"].lower() and not item["route"]:
                        item["route"] = "Sublingual"
            elif role == "patient" and du and not item["duration"]:
                item["duration"] = du.group(1)
    labels = {"prescribed": "Newly prescribed", "stopped": "STOP - discontinued by doctor",
              "current": "Current medication (patient reported)", "continued": "Continue",
              "mentioned": "Mentioned by patient", "changed": "Dose changed"}
    out = []
    for m in meds.values():
        if not m["status"] and not m["dose"]:
            continue  # mentioned only in passing by a clinician, e.g. drug-class discussion
        lead = labels.get(m["status"], "")
        if m["status"] == "changed" and m["prev"]:
            lead += f" (previously {m['prev']})"
        instr = "; ".join(_uniq([x for x in [lead] + m["notes"] if x]))
        out.append({"name": m["name"], "dose": m["dose"], "frequency": m["frequency"], "route": m["route"],
                    "duration": m["duration"], "instructions": instr})
    return out


def extract_locally(turns: list[dict[str, Any]], record: dict[str, Any]) -> dict[str, Any]:
    """Deterministic, transcript-grounded extraction. Every value is copied (or trimmed) from what was said."""
    names = _names(turns, record)
    sents = _sentences(turns, names)
    pat = [s for s in sents if s["role"] == "patient" and s["text"] and not s["question"]]
    clin = [s for s in sents if s["role"] in ("doctor", "student") and s["text"] and not s["question"]]
    doc = [s for s in clin if s["role"] == "doctor"]

    # Symptoms (patient statements only, negations excluded)
    symptoms: list[dict[str, str]] = []
    seen_sym: set[str] = set()
    first_sym_sentence: tuple[list[str], str] | None = None
    for s in pat:
        found = _sentence_symptoms(s["text"])
        new = [(n, m) for n, m in found if n not in seen_sym]
        if not new:
            continue
        dur = _duration_phrase(s["text"])
        for n, m in new:
            seen_sym.add(n)
            clause = _clause(s["text"], m.start(), m.end())
            sev = next((lvl for lvl, rx in SEVERITY if re.search(rx, clause, re.I)), "")
            note = re.sub(r"^(?:i|he|she|my \w+)\s+(?:also\s+)?(?:feel|have|has|had|get|gets|am having|is having|"
                          r"experience|notice)\s+(?:had\s+)?(?:a |an |this |these |some )?", "", clause, flags=re.I)
            symptoms.append({"name": n, "severity": sev, "duration": dur,
                             "notes": "" if note.lower() == n.lower() else (
                                 note[:1].upper() + note[1:] if len(note.split()) >= 3 else clause)})
        if first_sym_sentence is None:
            first_sym_sentence = ([n for n, _ in new], dur)
    chief = ""
    if first_sym_sentence:
        nm, dur = first_sym_sentence
        chief = _join_names([nm[0]] + [x.lower() for x in nm[1:]])
        chief += f" for {'the ' if re.match(r'(past|last) ', dur) else ''}{dur}" if dur else ""
    elif record.get("reason_for_visit"):
        chief = str(record["reason_for_visit"])
    hpi_rx = re.compile(r"\b(radiat\w*|worse\w*|better|relie\w*|trigger\w*|stops?|started|since|whenever|when|"
                        r"after|night|morning|evening|exertion|climb\w*|walking|eating|meals?|ago|checked|reading|"
                        r"was \d+|tests?)\b", re.I)
    hpi = [s["text"] for s in pat if _sentence_symptoms(s["text"]) or DUR.search(s["text"]) or hpi_rx.search(s["text"])]
    hpi = [h for h in hpi if not re.search(r"\b(family|mother|father|brother|sister)\b", h, re.I)]

    # Past history, allergies, family and social history
    pmh: list[str] = list(record.get("conditions") or [])
    pmh_dur: list[str] = []
    allergies: list[str] = list(record.get("allergies") or [])
    fam_rx = re.compile(r"\b(family|father|mother|brother|sister|parents?|grand\w+|wife|husband)\b", re.I)
    clauses = [c for s in pat for c in re.split(r",\s*(?:and|but)\s+|;\s*|\s+but\s+", s["text"])]
    for t in clauses:
        low = t.lower()
        if fam_rx.search(low):
            continue  # attributed to family history instead
        for key, label in CONDITIONS.items():
            if re.search(rf"{re.escape(key)}\s+(?:check|test|profile|report|levels?|function)", t, re.I):
                continue
            if _has(key, t) and re.search(r"\b(have|had|has|history|diagnosed|suffer\w*|known|for \w+ years|since|"
                                         r"did have|as a (?:child|toddler|baby))\b", low):
                m = re.search(rf"{re.escape(key)}[^.]*?\bfor (\d+|{'|'.join(WORDNUM)}) years?", t, re.I)
                when = re.search(r"as a (child|toddler|baby)|in (early )?childhood", t, re.I)
                extra = f" ({m.group(1)} years)" if m else (f" ({when.group(0)})" if when else "")
                if not any(key in p.lower() or label.lower() in p.lower() for p in pmh):
                    pmh.append(label + extra)
                if m:
                    pmh_dur.append(f"{label}: {m.group(1)} years")
    for s in [x for x in sents if x["text"] and not x["question"]]:
        t = s["text"]
        if re.search(r"\bno (?:known )?(?:drug )?allerg", t, re.I):
            continue
        for m in re.finditer(r"allergic to ([A-Za-z0-9\-]+(?: [a-z0-9\-]+)?)|allergy to ([A-Za-z0-9\-]+(?: [a-z0-9\-]+)?)|"
                             r"\b([A-Za-z\-]+) allergy\b", t, re.I):
            what = (m.group(1) or m.group(2) or m.group(3) or "").strip()
            if what.lower() in {"skin", "any", "no", "known", "drug", "food", "an", "the", "some", "seasonal"}:
                continue
            what = re.split(r"\s+(?:and|but|or|which|that)\b", what)[0]
            allergies.append(what.capitalize())
    if not allergies and any(re.search(r"\bno (?:known )?(?:drug )?allerg", s["text"], re.I) for s in sents if s["text"]):
        allergies = ["No known allergies (patient reported)"]
    fam: list[str] = []
    for s in pat + [x for x in clin if re.match(r"family history", x["text"], re.I)]:
        for m in re.finditer(r"\b(family|father|mother|brother|sister|parents|grandfather|grandmother)\b", s["text"], re.I):
            fam.append(_clause(s["text"], m.start(), m.end()).rstrip(".") + ".")
    social_rx = re.compile(r"\b(smok\w*|cigarettes?|alcohol|beer|whisky|tobacco|gutka|pan masala|i work|work (?:as|in|at)|"
                           r"my job|occupation|exercis\w*|vegetarian|married|live (?:with|alone)|promotion|stress\w*|"
                           r"student|retired|farmer|driver|teacher)\b", re.I)
    social = []
    for s in pat:
        m = social_rx.search(s["text"])
        if m:
            social.append(_clause(s["text"], m.start(), m.end()).rstrip(".") + ".")

    medications = _medications(sents)

    # Observations / vitals
    vitals = {k: "" for k in VITAL_KEYS}
    for s in [x for x in sents if x["text"] and not x["question"]]:
        for k, rx in VITALS.items():
            m = rx.search(s["text"])
            if m and not vitals[k]:
                unit = {"blood_pressure": " mmHg", "pulse": " bpm", "spo2": "%", "respiratory_rate": " /min",
                        "weight": " kg"}.get(k, "")
                if k == "temperature":
                    unit = " °" + ("C" if "c" in m.group(2).lower() else "F") if m.group(2).strip("° ").lower() in ("c", "f") else " °F"
                vitals[k] = m.group(1).replace(" ", "") + unit
    obs = [s["text"] for s in clin if re.search(r"\b(on examination|i can see|looks|appears|tender|swollen|"
                                                 r"auscultat\w*|chest is clear|reflex\w*|pupils?|throat is|abdomen is|"
                                                 r"bp is|blood pressure is|pulse is|spo2|temperature is)\b",
                                                 s["text"], re.I)]
    reported = [s["text"] for s in pat if re.search(r"\d+\s?(?:mg/dl|mmhg|bpm|%|°\s?[fc])|\b(?:tests?|check|report)\b[^.]*"
                                                    r"\b(normal|abnormal|high|low|positive|negative)\b", s["text"], re.I)]
    obs_summary = " ".join(_uniq(obs)[:4])
    if reported:
        obs_summary = (obs_summary + " " if obs_summary else "") + "Patient-reported: " + " ".join(_uniq(reported)[:3])

    # Investigations ordered by the doctor (in order of mention)
    inv_hits: list[tuple[int, int, str]] = []
    for si, s in enumerate(doc):
        if not (ORDER.search(s["text"]) or PLAN.search(s["text"]) or any(_has(t, s["text"]) for t in INVESTIGATIONS[:5])):
            continue
        conditional = re.match(r"if\b", s["text"], re.I)
        for t in sorted(INVESTIGATIONS, key=len, reverse=True):
            for m in re.finditer(rf"(?<![A-Za-z]){re.escape(t)}(?![A-Za-z])", s["text"], re.I):
                if any(a <= m.start() < b for _, a, b, *_ in [(x[0], x[1] % 10**6, x[1] % 10**6 + len(x[2])) for x in inv_hits if x[0] == si]):
                    continue
                label = m.group(0)
                label = label[:1].upper() + label[1:]
                inv_hits.append((si, m.start(), label + (" (if symptoms persist)" if conditional else "")))
    inv_hits.sort(key=lambda x: (x[0], x[1]))
    investigations = _uniq([h[2] for h in inv_hits])

    # Assessment: doctor impressions + student impressions explicitly endorsed by the doctor
    assess: list[str] = []
    uncertain: list[str] = [s["text"] for s in pat if HEDGE.search(s["text"])]
    for s in clin:
        if not ASSESS.search(s["text"]) or FOLLOW.search(s["text"]):
            continue
        if ORDER.search(s["text"]) and any(_has(t, s["text"]) for t in INVESTIGATIONS):
            continue  # an investigation order ("... to rule out anaemia"), not an impression
        if s["role"] == "doctor":
            assess.append(s["text"])
            continue
        nxt = next((t for t in turns[s["turn"] + 1:] if t["speaker_role"] != "student"), None)
        if nxt and nxt["speaker_role"] == "doctor" and AGREE.search(_clean(nxt["text"], names) or nxt["text"]) or (
                nxt and nxt["speaker_role"] == "doctor" and AGREE.search(nxt["text"])):
            assess.append(s["text"] + " (student impression, endorsed by doctor)")
        else:
            uncertain.append("Student impression not confirmed by doctor: " + s["text"])
    plan = [s["text"] for s in doc if PLAN.search(s["text"]) and not FOLLOW.search(s["text"])
            and not (ASSESS.search(s["text"]) and not re.search(r"\b(prescrib|start|stop|switch|take|add)\w*", s["text"], re.I))]
    follow = [s["text"] for s in doc if FOLLOW.search(s["text"])]

    sections: dict[str, Any] = {
        "chief_complaint": chief,
        "history_of_present_illness": " ".join(_uniq(hpi)[:8]),
        "symptoms": symptoms,
        "duration": "; ".join(_uniq([f"{x['name']}: {x['duration']}" for x in symptoms if x["duration"]] + pmh_dur)),
        "past_medical_history": _uniq(pmh),
        "medications": medications,
        "allergies": _uniq(allergies),
        "family_history": " ".join(_uniq(fam)[:3]),
        "social_history": " ".join(_uniq(social)[:3]),
        "doctor_observations": {"summary": obs_summary, "vitals": vitals},
        "investigations": investigations,
        "assessment": " ".join(_uniq(assess)[:4]),
        "treatment_plan": "\n".join(f"- {s}" for s in _uniq(plan)[:10]),
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
