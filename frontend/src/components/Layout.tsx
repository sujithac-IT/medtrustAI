import React, { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '../i18n/config'
import i18n from '../i18n/config'

const NAV_ITEMS = [
  { to: '/dashboard',            icon: '⬡',  label: 'Dashboard',            section: 'main' },
  { to: '/consultation',         icon: '📹',  label: 'Live Consultation',     section: 'main', highlight: true },
  { to: '/patients',             icon: '👥',  label: 'Patients',              section: 'main' },
  { to: '/case-sheets',          icon: '📋',  label: 'Case Sheets',           section: 'main' },
  { to: '/history',              icon: '🕒',  label: 'Consultation History',  section: 'main' },
  { to: '/multilingual-summary', icon: '🌐',  label: 'Multilingual Summary',  section: 'tools' },
  { to: '/settings',             icon: '⚙️',  label: 'Settings',              section: 'tools' },
]

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

  const initials = user?.displayName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'
  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) || SUPPORTED_LANGUAGES[0]

  const mainItems = NAV_ITEMS.filter(n => n.section === 'main')
  const toolItems = NAV_ITEMS.filter(n => n.section === 'tools')

  const getPageTitle = () => {
    const path = location.pathname
    if (path.includes('/consultation')) return 'Live Consultation'
    if (path.includes('/patients')) return 'Patient Management'
    if (path.includes('/case-sheet')) return 'Clinical Case Sheet'
    if (path.includes('/case-sheets')) return 'Case Sheets'
    if (path.includes('/history')) return 'Consultation History'
    if (path.includes('/multilingual-summary')) return 'Multilingual Summary'
    if (path.includes('/settings')) return 'Settings'
    return 'Dashboard'
  }

  return (
    <div className="app-layout">
      {/* Background decoration */}
      <div className="page-bg-decoration" />

      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 49, backdropFilter: 'blur(4px)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">⚕️</div>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-name">MedTrust AI</span>
            <span className="sidebar-logo-sub">AI-Powered Clinical Care</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <span className="sidebar-section-label">Main Menu</span>
          {mainItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
              style={item.highlight ? {
                background: 'linear-gradient(135deg, rgba(0,212,170,0.15), rgba(56,189,248,0.1))',
              } : {}}
            >
              <span style={{ fontSize: 17 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
            </NavLink>
          ))}

          <span className="sidebar-section-label" style={{ marginTop: 12 }}>Tools & Settings</span>

          {toolItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span style={{ fontSize: 17 }}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}

          {/* Language selector */}
          <div style={{ position: 'relative', marginTop: 4 }}>
            <button
              className="nav-item"
              style={{ width: '100%', textAlign: 'left', justifyContent: 'flex-start', border: 'none', cursor: 'pointer' }}
              onClick={() => setLangMenuOpen(!langMenuOpen)}
            >
              <span style={{ fontSize: 17 }}>🌍</span>
              <span style={{ flex: 1 }}>Language</span>
              <span style={{ fontSize: 11, color: 'var(--color-teal)', background: 'var(--color-teal-dim)', borderRadius: 4, padding: '2px 6px' }}>
                {currentLang.flag} {currentLang.name}
              </span>
            </button>

            {langMenuOpen && (
              <div style={{
                position: 'absolute',
                left: '100%',
                top: 0,
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 8,
                minWidth: 160,
                zIndex: 200,
                boxShadow: 'var(--shadow-lg)',
              }}>
                {SUPPORTED_LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => { i18n.changeLanguage(lang.code); setLangMenuOpen(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '8px 12px',
                      background: i18n.language === lang.code ? 'var(--color-teal-dim)' : 'transparent',
                      border: 'none', borderRadius: 'var(--radius-sm)',
                      color: i18n.language === lang.code ? 'var(--color-teal)' : 'var(--color-text-secondary)',
                      cursor: 'pointer', fontSize: 13, fontWeight: 500,
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
            style={{ width: '100%', color: 'var(--color-danger)', border: 'none', background: 'transparent', cursor: 'pointer', marginTop: 4 }}
            onClick={handleLogout}
          >
            <span style={{ fontSize: 17 }}>🚪</span>
            <span>Logout</span>
          </button>
        </nav>

        {/* User card at bottom */}
        <div className="sidebar-user">
          <div className="sidebar-user-card">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.displayName}</div>
              <div className="sidebar-user-role">
                {user?.role === 'doctor'
                  ? `Senior Doctor • MD`
                  : 'Patient'}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content content-wrapper">
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

          {/* Page title and date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {getPageTitle()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </div>

          <div className="topbar-actions">
            {/* Google Meet status badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px',
              background: 'rgba(34,197,94,0.1)',
              borderRadius: 'var(--radius-full)',
              border: '1px solid rgba(34,197,94,0.3)',
              fontSize: 12,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block', boxShadow: '0 0 6px var(--color-success)' }} />
              <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>Google Meet • Connected</span>
            </div>

            {/* Notifications */}
            <button className="btn btn-ghost btn-icon" style={{ position: 'relative' }}>
              <span style={{ fontSize: 18 }}>🔔</span>
              <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: 'var(--color-danger)', border: '2px solid var(--color-bg-primary)' }} />
            </button>

            {/* User avatar + name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{user?.displayName}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Senior Doctor • MD</div>
              </div>
              <div className="sidebar-avatar" style={{ width: 38, height: 38, fontSize: 14 }}>{initials}</div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="page-container animate-fade-in">
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
