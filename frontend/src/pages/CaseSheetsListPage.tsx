import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CaseSheet } from '../types'

export default function CaseSheetsListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending'>('all')

  const sheets = useMemo<CaseSheet[]>(() => {
    const saved = localStorage.getItem('medtrust_case_sheets')
    if (saved) {
      try { return JSON.parse(saved) } catch { /* skip */ }
    }
    return []
  }, [])

  const filtered = useMemo(() => {
    return sheets.filter(s => {
      if (filter === 'approved' && !s.isApproved) return false
      if (filter === 'pending' && s.isApproved) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return s.patientName.toLowerCase().includes(q) ||
          s.chiefComplaint.toLowerCase().includes(q) ||
          s.assessment.toLowerCase().includes(q)
      }
      return true
    })
  }, [sheets, search, filter])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="section-header">
        <div>
          <h1 className="section-title">📋 Case Sheets</h1>
          <p className="section-subtitle">All AI-generated clinical case sheets from teleconsultations</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/consultation')}>
          📹 New Consultation
        </button>
      </div>

      {/* Search and filter */}
      <div className="card" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 220 }}>
            <span>🔍</span>
            <input
              className="form-input"
              style={{ margin: 0 }}
              placeholder="Search case sheets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['all', 'approved', 'pending'] as const).map(f => (
              <button
                key={f}
                className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <span style={{ fontSize: 48 }}>📋</span>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 12 }}>No Case Sheets Yet</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
            Start a consultation to generate AI case sheets.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/consultation')}>
            Start Teleconsultation
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(s => (
            <div
              key={s.id}
              className="card"
              style={{
                padding: 18,
                cursor: 'pointer',
                borderLeft: `4px solid ${s.isApproved ? 'var(--color-teal)' : 'var(--color-warning)'}`,
                transition: 'all 0.2s',
              }}
              onClick={() => navigate(`/case-sheet/${s.id}`)}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-teal)' }}
              onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderLeft = `4px solid ${s.isApproved ? 'var(--color-teal)' : 'var(--color-warning)'}` }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                <div className="avatar avatar-teal" style={{ fontSize: 15 }}>
                  {s.patientName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>{s.patientName}</span>
                    {s.isApproved
                      ? <span className="badge badge-success badge-dot">Approved</span>
                      : <span className="badge badge-warning badge-dot">Pending</span>
                    }
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-teal)', marginTop: 3 }}>{s.chiefComplaint}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2, overflow: 'hidden', maxHeight: 20 }}>{s.assessment}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {new Date(s.generatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{s.doctorName}</div>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={e => { e.stopPropagation(); navigate(`/case-sheet/${s.id}`) }}
                >
                  Open →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
