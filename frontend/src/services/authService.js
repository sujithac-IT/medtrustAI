/**
 * MedTrust AI - Authentication & Role-Based Session Service
 * Provides Firebase Authentication integration with seamless Demo Mode fallback.
 * Manages user sessions for Doctors, Medical Students, and Patients.
 */

class AuthService {
  constructor() {
    this.currentUser = null;
    this.isDemoMode = true;
    this.firebaseAuth = null;
    this.listeners = [];
  }

  /**
   * Initializes auth session by checking current server session or default profile.
   */
  async init() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        this.currentUser = await res.json();
        this._notifyListeners();
        return this.currentUser;
      }
    } catch (err) {
      console.warn("Auth initialization failed, using demo doctor fallback:", err);
    }

    // Default fallback
    this.currentUser = {
      id: "doc-1",
      name: "Dr. Rajesh Sharma, MD",
      role: "doctor",
      email: "dr.sharma@medtrust.hospital.org",
      registration_number: "TNMC-84920",
      specialization: "Internal Medicine & Cardiology",
      permissions: {
        can_conduct_consultations: true,
        can_sign_case_sheets: true,
        can_edit_case_sheets: true,
        can_manage_patients: true,
        is_doctor: true,
        is_student: false,
        is_patient: false
      }
    };
    this._notifyListeners();
    return this.currentUser;
  }

  /**
   * 1-Click Role Switcher for clinical multi-perspective testing.
   */
  async switchRole(userId) {
    try {
      const res = await fetch(`/api/auth/switch-role/${userId}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        this.currentUser = data.user;
        this._notifyListeners();
        return this.currentUser;
      }
    } catch (err) {
      console.error("Failed to switch role:", err);
    }
    return null;
  }

  /**
   * Firebase Login with demo fallback.
   */
  async loginWithFirebase(idToken = "", role = "doctor") {
    try {
      const res = await fetch("/api/auth/firebase-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: idToken, role: role })
      });
      if (res.ok) {
        const data = await res.json();
        this.currentUser = data.user;
        this.isDemoMode = data.is_demo_fallback;
        this._notifyListeners();
        return data;
      }
    } catch (err) {
      console.error("Firebase login error:", err);
    }
    return null;
  }

  /**
   * Logs out user and resets perspective.
   */
  async logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      await this.init();
    } catch (err) {
      console.error("Logout error:", err);
    }
  }

  getUser() {
    return this.currentUser;
  }

  isDoctor() {
    return this.currentUser?.role === "doctor";
  }

  isStudent() {
    return this.currentUser?.role === "student";
  }

  isPatient() {
    return this.currentUser?.role === "patient";
  }

  canSignCaseSheet() {
    return this.currentUser?.permissions?.can_sign_case_sheets === true;
  }

  canEditCaseSheet() {
    return this.currentUser?.permissions?.can_edit_case_sheets === true;
  }

  onAuthStateChanged(callback) {
    this.listeners.push(callback);
    if (this.currentUser) callback(this.currentUser);
  }

  _notifyListeners() {
    this.listeners.forEach(cb => {
      try { cb(this.currentUser); } catch (e) { console.error(e); }
    });
  }
}

// Export singleton
if (typeof window !== "undefined") {
  window.authService = new AuthService();
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = AuthService;
}
