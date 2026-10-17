import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import type { Role } from './api/types'
import Layout from './components/Layout'
import { FullPageSpinner, Spinner } from './components/ui'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'

// Route-level code splitting: the first load only ships the login + dashboard bundle,
// which matters on slow hospital networks and low-end phones.
const PatientsPage = lazy(() => import('./pages/PatientsPage'))
const PatientDetailPage = lazy(() => import('./pages/PatientDetailPage'))
const ConsultationsPage = lazy(() => import('./pages/ConsultationsPage'))
const ConsultationDetailPage = lazy(() => import('./pages/ConsultationDetailPage'))
const RoomPage = lazy(() => import('./pages/RoomPage'))
const CaseSheetPage = lazy(() => import('./pages/CaseSheetPage'))
const CaseSheetsPage = lazy(() => import('./pages/CaseSheetsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const StaffPage = lazy(() => import('./pages/StaffPage'))

function Protected({ roles, admin, children, bare }: { roles?: Role[]; admin?: boolean; children: ReactNode; bare?: boolean }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <FullPageSpinner label="Restoring session" />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  if ((roles && !roles.includes(user.role)) || (admin && !user.is_admin)) return <Navigate to="/" replace />
  const page = <Suspense fallback={bare ? <FullPageSpinner label="Loading" /> : <Spinner />}>{children}</Suspense>
  return bare ? page : <Layout>{page}</Layout>
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
      <Route path="/staff" element={<Protected roles={['doctor']} admin><StaffPage /></Protected>} />
      <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
