import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ConsultationPage from './pages/ConsultationPage'
import PatientsPage from './pages/PatientsPage'
import HistoryPage from './pages/HistoryPage'
import CaseSheetPage from './pages/CaseSheetPage'
import CaseSheetsListPage from './pages/CaseSheetsListPage'
import MultilingualSummaryPage from './pages/MultilingualSummaryPage'
import SettingsPage from './pages/SettingsPage'

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 48, height: 48, border: '3px solid rgba(0,212,170,0.2)', borderTop: '3px solid #00D4AA', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <p style={{ color: '#94A3B8', fontSize: 14 }}>Loading MedTrust AI...</p>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/consultation" element={<ConsultationPage />} />
                  <Route path="/consultation/:id" element={<ConsultationPage />} />
                  <Route path="/patients" element={<PatientsPage />} />
                  <Route path="/history" element={<HistoryPage />} />
                  <Route path="/history/:patientId" element={<HistoryPage />} />
                  <Route path="/case-sheet/:id" element={<CaseSheetPage />} />
                  <Route path="/case-sheets" element={<CaseSheetsListPage />} />
                  <Route path="/multilingual-summary" element={<MultilingualSummaryPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  )
}
