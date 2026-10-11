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


def _scenario(key):
    from app.services import samples
    sc = samples.get_scenario(key)
    turns = normalize_turns([{"speaker_role": t["speaker"], "speaker_name": t["speaker_name"], "text": t["text"],
                              "offset_ms": i * 20000} for i, t in enumerate(sc["turns"])])
    return extract_locally(turns, {"allergies": [], "conditions": [], "name": sc["patient_name"]})


def test_medication_status_and_dose_parsing():
    s = _scenario("cardiology")
    meds = {m["name"]: m for m in s["medications"]}
    assert meds["Enalapril"]["instructions"].startswith("STOP")
    assert meds["Telmisartan"]["dose"] == "40mg" and "prescribed" in meds["Telmisartan"]["instructions"].lower()
    assert meds["Sorbitrate"]["route"] == "Sublingual"
    # instructions are short structured notes, never whole sentences with vocatives
    assert all("Sundaram" not in m["instructions"] for m in s["medications"])
    assert s["chief_complaint"].startswith("Chest heaviness")


def test_dose_change_keeps_previous_dose():
    s = _scenario("diabetes")
    met = next(m for m in s["medications"] if m["name"] == "Metformin")
    assert met["dose"] == "1000mg" and met["frequency"] == "twice daily"
    assert "previously 500mg" in met["instructions"]
    assert "Lakshmi" not in s["treatment_plan"]
    assert "Diabetes mellitus (8 years)" in s["past_medical_history"]


def test_family_history_not_in_pmh_and_investigation_conditional():
    p = _scenario("pediatrics")
    assert "mother" in p["family_history"].lower()
    assert not any("asthma" in x.lower() for x in p["past_medical_history"])
    assert p["doctor_observations"]["vitals"]["temperature"].startswith("98.6")
    g = _scenario("gastroenterology")
    assert "Upper GI endoscopy (if symptoms persist)" in g["investigations"]
    assert next(m for m in g["medications"] if m["name"] == "Ibuprofen")["instructions"].startswith("STOP")


def test_every_med_and_investigation_is_grounded():
    from app.services import samples
    for key in samples.CLINICAL_SCENARIOS:
        text = " ".join(t["text"] for t in samples.get_scenario(key)["turns"]).lower()
        s = _scenario(key)
        for m in s["medications"]:
            assert m["name"].lower() in text and (not m["dose"] or m["dose"].lower() in text)
        for i in s["investigations"]:
            assert i.replace(" (if symptoms persist)", "").lower() in text
