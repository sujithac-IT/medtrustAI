import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '../i18n/config'
import i18n from '../i18n/config'

const NAV_ITEMS = [
  { to: '/dashboard',     icon: '⬡',  labelKey: 'nav_dashboard',    badge: 0 },
  { to: '/consultation',  icon: '📹',  labelKey: 'nav_consultation', badge: 0 },
  { to: '/patients',      icon: '👥',  labelKey: 'nav_patients',     badge: 0 },
  { to: '/history',       icon: '📋',  labelKey: 'nav_history',      badge: 0 },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [langMenuOpen, setLangMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const initials = user?.displayName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'
  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) || SUPPORTED_LANGUAGES[0]

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
            <span className="sidebar-logo-sub">Clinical Intelligence</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <span className="sidebar-section-label">Main Menu</span>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span>{t(item.labelKey)}</span>
              {item.badge > 0 && <span className="nav-item-badge">{item.badge}</span>}
            </NavLink>
          ))}

          <span className="sidebar-section-label" style={{ marginTop: 8 }}>Account</span>

          {/* Language selector */}
          <div style={{ position: 'relative' }}>
            <button
              className="nav-item"
              style={{ width: '100%', textAlign: 'left', justifyContent: 'flex-start' }}
              onClick={() => setLangMenuOpen(!langMenuOpen)}
            >
              <span style={{ fontSize: 18 }}>🌐</span>
              <span style={{ flex: 1 }}>Language</span>
              <span style={{ fontSize: 12, color: 'var(--color-teal)' }}>{currentLang.flag} {currentLang.name}</span>
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
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '8px 12px',
                      background: i18n.language === lang.code ? 'var(--color-teal-dim)' : 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      color: i18n.language === lang.code ? 'var(--color-teal)' : 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 500,
                      transition: 'all var(--transition-fast)',
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
            style={{ width: '100%', color: 'var(--color-danger)', border: 'none', background: 'transparent', cursor: 'pointer' }}
            onClick={handleLogout}
          >
            <span style={{ fontSize: 18 }}>🚪</span>
            <span>{t('nav_logout')}</span>
          </button>
        </nav>

        {/* User card */}
        <div className="sidebar-user">
          <div className="sidebar-user-card">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.displayName}</div>
              <div className="sidebar-user-role">{user?.role === 'doctor' ? `Dr. ${user?.specialization || 'Medical Doctor'}` : 'Patient'}</div>
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
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
          <div className="topbar-actions">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              background: 'var(--color-teal-dim)',
              borderRadius: 'var(--radius-full)',
              border: '1px solid rgba(0,212,170,0.2)',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-teal)', display: 'inline-block' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-teal)' }}>
                {user?.role === 'doctor' ? 'DOCTOR' : 'PATIENT'}
              </span>
            </div>
            <div className="sidebar-avatar" style={{ width: 36, height: 36, fontSize: 13 }}>{initials}</div>
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
