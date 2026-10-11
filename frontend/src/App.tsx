import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import type { Role } from './api/types'
import Layout from './components/Layout'
import { FullPageSpinner } from './components/ui'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import PatientsPage from './pages/PatientsPage'
import PatientDetailPage from './pages/PatientDetailPage'
import ConsultationsPage from './pages/ConsultationsPage'
import ConsultationDetailPage from './pages/ConsultationDetailPage'
import RoomPage from './pages/RoomPage'
import CaseSheetPage from './pages/CaseSheetPage'
import CaseSheetsPage from './pages/CaseSheetsPage'
import SettingsPage from './pages/SettingsPage'

function Protected({ roles, children, bare }: { roles?: Role[]; children: ReactNode; bare?: boolean }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <FullPageSpinner label="Restoring session" />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return bare ? <>{children}</> : <Layout>{children}</Layout>
}

const STAFF: Role[] = ['doctor', 'student']

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/room/:code" element={<Protected bare><RoomPage /></Protected>} />
      <Route path="/" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/patients" element={<Protected roles={STAFF}><PatientsPage /></Protected>} />
      <Route path="/patients/:id" element={<Protected><PatientDetailPage /></Protected>} />
      <Route path="/consultations" element={<Protected><ConsultationsPage /></Protected>} />
      <Route path="/consultations/:id" element={<Protected><ConsultationDetailPage /></Protected>} />
      <Route path="/case-sheets" element={<Protected><CaseSheetsPage /></Protected>} />
      <Route path="/case-sheets/:id" element={<Protected><CaseSheetPage /></Protected>} />
      <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
