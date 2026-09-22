import React from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
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
import WaitingRoomPage from './pages/WaitingRoomPage'

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 44, height: 44, border: '3px solid rgba(11,87,208,0.2)', borderTop: '3px solid #0B57D0', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <p style={{ color: '#64748B', fontSize: 13, fontWeight: 500 }}>Connecting to MedTrust Telehealth...</p>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Redirect helper for direct Google Meet-style links e.g. /meet/abc-defg-hij
function MeetLinkRedirect() {
  const { code } = useParams<{ code?: string }>()
  return <Navigate to={`/waiting-room/${code || 'abc-defg-hij'}`} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Routes: Login and Patient Waiting Room */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/waiting-room" element={<WaitingRoomPage />} />
        <Route path="/waiting-room/:code" element={<WaitingRoomPage />} />
        <Route path="/meet/:code" element={<MeetLinkRedirect />} />

        {/* Doctor & Clinical Staff Protected Routes */}
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
