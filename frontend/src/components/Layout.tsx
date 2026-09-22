import React, { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '../i18n/config'
import i18n from '../i18n/config'
import {
  StethoscopeIcon,
  HospitalCrossIcon,
  PulseIcon,
  ClipboardMedicalIcon,
  WaitingRoomIcon,
  GlobeLanguageIcon,
  DoctorHostIcon,
  PatientIcon,
  VideoMeetIcon,
  ShieldCheckIcon,
} from './MedicalIcons'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [langMenuOpen, setLangMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const initials = user?.displayName?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'DR'
  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) || SUPPORTED_LANGUAGES[0]

  const getPageTitle = () => {
    const path = location.pathname
    if (path.includes('/consultation')) return 'Live Consultation'
    if (path.includes('/patients')) return 'Patient Management'
    if (path.includes('/case-sheet')) return 'Clinical Case Sheet'
    if (path.includes('/case-sheets')) return 'Clinical Case Sheets'
    if (path.includes('/history')) return 'Consultation History'
    if (path.includes('/multilingual-summary')) return 'Multilingual Scribe'
    if (path.includes('/waiting-room')) return 'Patient Waiting Area'
    if (path.includes('/settings')) return 'Settings'
    return 'Dashboard'
  }

  return (
    <div className="app-layout">
      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 49, backdropFilter: 'blur(4px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar with Hospital Material 3 Theme */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <HospitalCrossIcon size={22} color="#FFFFFF" />
          </div>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-name">MedTrust AI</span>
            <span className="sidebar-logo-sub">Clinical Intelligence</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <span className="sidebar-section-label">Main Menu</span>

          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <PulseIcon size={18} color="currentColor" />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/consultation"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
            style={{
              backgroundColor: location.pathname.includes('/consultation') ? '#EFF6FF' : undefined,
              color: location.pathname.includes('/consultation') ? '#0B57D0' : undefined,
            }}
          >
            <VideoMeetIcon size={18} color="currentColor" />
            <span style={{ flex: 1 }}>Live Consultation</span>
            <span style={{
              fontSize: 10,
              backgroundColor: '#10B981',
              color: '#FFFFFF',
              padding: '1px 6px',
              borderRadius: 10,
              fontWeight: 700,
            }}>
              HOST
            </span>
          </NavLink>

          <NavLink
            to="/patients"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <PatientIcon size={18} color="currentColor" />
            <span>Patients</span>
          </NavLink>

          <NavLink
            to="/case-sheets"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <ClipboardMedicalIcon size={18} color="currentColor" />
            <span>Case Sheets</span>
          </NavLink>

          <NavLink
            to="/history"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <WaitingRoomIcon size={18} color="currentColor" />
            <span>Consultation History</span>
          </NavLink>

          <span className="sidebar-section-label" style={{ marginTop: 14 }}>Clinical AI & Tools</span>

          <NavLink
            to="/multilingual-summary"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <GlobeLanguageIcon size={18} color="currentColor" />
            <span>Multilingual Scribe</span>
          </NavLink>

          <NavLink
            to="/waiting-room"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <StethoscopeIcon size={18} color="currentColor" />
            <span>Waiting Room Preview</span>
          </NavLink>

          {/* Language selector */}
          <div style={{ position: 'relative', marginTop: 4 }}>
            <button
              className="nav-item"
              style={{ width: '100%', textAlign: 'left', justifyContent: 'flex-start', border: 'none', background: 'transparent', cursor: 'pointer' }}
              onClick={() => setLangMenuOpen(!langMenuOpen)}
            >
              <GlobeLanguageIcon size={18} color="currentColor" />
              <span style={{ flex: 1 }}>Language</span>
              <span style={{ fontSize: 11, color: '#0B57D0', backgroundColor: '#EFF6FF', borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>
                {currentLang.flag} {currentLang.name}
              </span>
            </button>

            {langMenuOpen && (
              <div style={{
                position: 'absolute',
                left: 0,
                bottom: '100%',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: 6,
                minWidth: 190,
                zIndex: 200,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              }}>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => { i18n.changeLanguage(lang.code); setLangMenuOpen(false) }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '7px 10px',
                      backgroundColor: i18n.language === lang.code ? '#EFF6FF' : 'transparent',
                      border: 'none',
                      borderRadius: 6,
                      color: i18n.language === lang.code ? '#0B57D0' : '#475569',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      fontWeight: 500,
                      textAlign: 'left',
                    }}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.nativeName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className="nav-item"
            style={{ width: '100%', color: '#DC2626', border: 'none', background: 'transparent', cursor: 'pointer', marginTop: 8 }}
            onClick={handleLogout}
          >
            <span style={{ fontSize: 16 }}>🚪</span>
            <span>Logout</span>
          </button>
        </nav>

        {/* User Card (Host Attending Doctor) */}
        <div className="sidebar-user">
          <div className="sidebar-user-card">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.displayName || 'Dr. Rajesh Sharma, MD'}</div>
              <div className="sidebar-user-role">
                <span style={{ color: '#0B57D0', fontWeight: 600 }}>Senior Consultant</span> • Host
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ display: 'none' }}
            id="sidebar-toggle"
          >
            ☰
          </button>

          {/* Page Title & Timestamp */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
                {getPageTitle()}
              </div>
              <div style={{ fontSize: 11, color: '#64748B' }}>
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </div>

          <div className="topbar-actions">
            {/* Google Meet Connected Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              backgroundColor: '#ECFDF5',
              borderRadius: 20,
              border: '1px solid #A7F3D0',
              fontSize: 12,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block' }} />
              <span style={{ fontWeight: 600, color: '#047857' }}>Google Meet • Connected</span>
            </div>

            {/* Doctor Profile Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 6 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                  {user?.displayName || 'Dr. Rajesh Sharma, MD'}
                </div>
                <div style={{ fontSize: 11, color: '#64748B' }}>Cardiology & Internal Medicine</div>
              </div>
              <div className="sidebar-avatar" style={{ width: 36, height: 36, fontSize: 13 }}>
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="page-container">
          {children}
        </div>
      </main>

      <style>{`
        @media (max-width: 1024px) {
          #sidebar-toggle { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
