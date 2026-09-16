/**
 * MedTrust AI - API Client Service
 * Centralized HTTP service for Google Meet Telehealth, 17-Section Case Sheets,
 * Patient Directory, and Doctor Electronic Sign-Off.
 */

const API_BASE = "";

class ApiService {
  async _request(url, options = {}) {
    const res = await fetch(`${API_BASE}${url}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    if (!res.ok) {
      let errorDetail = "API Error";
      try {
        const errorData = await res.json();
        errorDetail = errorData.detail || errorDetail;
      } catch (_) {}
      throw new Error(errorDetail);
    }
    return res.json();
  }

  // --- Consultations & Google Meet ---
  async getConsultations() {
    return this._request("/api/consultations/");
  }

  async getConsultation(id) {
    return this._request(`/api/consultations/${id}`);
  }

  async createConsultation(patientId, doctorId = "doc-1", studentId = "stu-1") {
    return this._request("/api/consultations/", {
      method: "POST",
      body: JSON.stringify({ patient_id: patientId, doctor_id: doctorId, student_id: studentId })
    });
  }

  async addTranscriptTurn(consultationId, turnData) {
    return this._request(`/api/consultations/${consultationId}/transcripts`, {
      method: "POST",
      body: JSON.stringify(turnData)
    });
  }

  async loadScenario(consultationId, scenarioKey) {
    return this._request(`/api/consultations/${consultationId}/load-scenario/${scenarioKey}`, {
      method: "POST"
    });
  }

  async getGoogleMeetTranscripts(spaceId) {
    return this._request(`/spaces/${spaceId}/transcripts`);
  }

  // --- 17-Section AI Case Sheet ---
  async getCaseSheet(consultationId) {
    return this._request(`/api/casesheets/${consultationId}`);
  }

  async generateCaseSheet(consultationId) {
    return this._request(`/api/casesheets/generate/${consultationId}`, {
      method: "POST"
    });
  }

  async updateCaseSheet(caseSheetId, sections) {
    return this._request(`/api/casesheets/${caseSheetId}`, {
      method: "PUT",
      body: JSON.stringify({ sections })
    });
  }

  async approveDoctorSignOff(caseSheetId, approvalData) {
    return this._request(`/api/casesheets/${caseSheetId}/approve`, {
      method: "POST",
      body: JSON.stringify(approvalData)
    });
  }

  getPrintableCaseSheetUrl(caseSheetId) {
    return `/api/casesheets/${caseSheetId}/print`;
  }

  // --- Patient Management ---
  async getPatients(searchTerm = "") {
    const query = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : "";
    return this._request(`/api/patients/${query}`);
  }

  async createPatient(patientData) {
    return this._request("/api/patients/", {
      method: "POST",
      body: JSON.stringify(patientData)
    });
  }

  async getPatient(patientId) {
    return this._request(`/api/patients/${patientId}`);
  }

  // --- Auth & Session ---
  async getCurrentUser() {
    return this._request("/api/auth/me");
  }

  async switchRole(userId) {
    return this._request(`/api/auth/switch-role/${userId}`, { method: "POST" });
  }

  async login(credentials) {
    return this._request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials)
    });
  }
}

// Export singleton
if (typeof window !== "undefined") {
  window.apiService = new ApiService();
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = ApiService;
}
