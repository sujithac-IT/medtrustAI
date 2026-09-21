import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function SettingsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState(true)
  const [darkMode, setDarkMode] = useState(true)
  const [autoGenerate, setAutoGenerate] = useState(true)
  const [defaultLang, setDefaultLang] = useState('en')
  const [saved, setSaved] = useState(false)

  const save = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>
      <div>
        <h1 className="section-title">⚙️ Settings</h1>
        <p className="section-subtitle">Configure your MedTrust AI clinical workspace preferences</p>
      </div>

      {/* Profile */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}><span>👤</span> Profile</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div className="sidebar-avatar" style={{ width: 56, height: 56, fontSize: 20 }}>
            {user?.displayName?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'DR'}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)' }}>{user?.displayName}</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{user?.email} · {user?.role === 'doctor' ? 'Senior Doctor · MD' : 'Patient'}</div>
            <span className="badge badge-teal" style={{ marginTop: 6 }}>Demo Mode Active</span>
          </div>
        </div>
        <div className="grid grid-2" style={{ gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input className="form-input" defaultValue={user?.displayName || ''} />
          </div>
          <div className="form-group">
            <label className="form-label">Specialization</label>
            <input className="form-input" defaultValue="Internal Medicine" />
          </div>
        </div>
      </div>

      {/* App preferences */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}><span>🎛️</span> App Preferences</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Push Notifications', desc: 'Receive alerts for new consultations and approvals', val: notifications, set: setNotifications },
            { label: 'Dark Mode', desc: 'Use dark glassmorphism theme (recommended)', val: darkMode, set: setDarkMode },
            { label: 'Auto-Generate Case Sheet', desc: 'Automatically trigger AI generation when recording ends', val: autoGenerate, set: setAutoGenerate },
          ].map(pref => (
            <div key={pref.label} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px',
              background: 'var(--color-bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>{pref.label}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{pref.desc}</div>
              </div>
              <button
                onClick={() => pref.set(!pref.val)}
                style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: pref.val ? 'var(--color-teal)' : 'var(--color-border)',
                  border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                  flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute', top: 2, left: pref.val ? 22 : 2,
                  width: 20, height: 20, borderRadius: '50%', background: 'white',
                  transition: 'left 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Language */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 12 }}><span>🌐</span> Language & Regional</div>
        <div className="form-group">
          <label className="form-label">Default Summary Language</label>
          <select className="form-select" value={defaultLang} onChange={e => setDefaultLang(e.target.value)}>
            <option value="en">🇬🇧 English</option>
            <option value="ta">🇮🇳 Tamil (தமிழ்)</option>
            <option value="hi">🇮🇳 Hindi (हिन्दी)</option>
            <option value="te">🇮🇳 Telugu (తెలుగు)</option>
            <option value="ml">🇮🇳 Malayalam (മലയാളം)</option>
            <option value="kn">🇮🇳 Kannada (ಕನ್ನಡ)</option>
          </select>
        </div>
      </div>

      {/* API / Integrations */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 12 }}><span>🔗</span> API Integrations</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { name: 'Google Gemini AI', status: 'Demo / Local NLP Fallback', color: 'amber' },
            { name: 'Firebase Authentication', status: 'Demo Mode', color: 'amber' },
            { name: 'Google Meet', status: 'WebRTC Demo Mode', color: 'amber' },
            { name: 'Cloud Run Backend', status: 'Not configured', color: 'muted' },
          ].map(api => (
            <div key={api.name} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', background: 'var(--color-bg-glass)',
              borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{api.name}</span>
              <span className={`badge badge-${api.color}`}>{api.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <button
        className="btn btn-primary"
        style={{ alignSelf: 'flex-start', minWidth: 140, padding: '12px 24px' }}
        onClick={save}
      >
        {saved ? '✅ Saved!' : '💾 Save Settings'}
      </button>
    </div>
  )
}
