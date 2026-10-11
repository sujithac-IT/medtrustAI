from app.services.casesheet import extract_locally, normalize_sections, SECTION_KEYS
from app.services.transcript import normalize_turns


def _t(role, text, ms):
    return {"speaker_role": role, "speaker_name": role, "text": text, "offset_ms": ms}


def test_normalize_merges_and_dedupes():
    turns = normalize_turns([_t("patient", "i have fever", 0), _t("patient", "since two days", 2000),
                             _t("patient", "since two days", 2500), _t("doctor", "ok", 3000)])
    assert len(turns) == 2 and turns[0]["text"] == "I have fever. Since two days"


def test_no_fabrication_on_sparse_transcript():
    turns = normalize_turns([_t("doctor", "Hello, how are you?", 0), _t("patient", "Fine thank you.", 1000)])
    s = extract_locally(turns, {"allergies": [], "conditions": []})
    assert s["medications"] == [] and s["assessment"] == "" and s["investigations"] == []
    assert not any(s["doctor_observations"]["vitals"].values())
    assert len(s["missing_information"]) >= 5


def test_negation_not_symptom():
    turns = normalize_turns([_t("patient", "I have no fever but a bad headache for 3 days.", 0)])
    s = extract_locally(turns, {"allergies": [], "conditions": []})
    names = [x["name"].lower() for x in s["symptoms"]]
    assert "headache" in names and "fever" not in names


def test_normalize_has_all_sections():
    out = normalize_sections({}, {"name": "X"})
    assert set(SECTION_KEYS) <= set(out)
