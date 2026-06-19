import { Routes, Route, Navigate } from 'react-router-dom'
import { PortalAuthProvider, usePortalAuth } from './store/portalAuthContext'
import PortalShell from './components/PortalShell'
import PortalLogin from './pages/PortalLogin'
import PortalProject from './pages/PortalProject'
import PortalApprovals from './pages/PortalApprovals'
import PortalSnags from './pages/PortalSnags'
import PortalDocuments from './pages/PortalDocuments'
import PortalPayments from './pages/PortalPayments'

function PortalProtectedRoute({ children }) {
  const { portalUser, loading } = usePortalAuth()
  if (loading) return <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--color-bg)' }}>Loading...</div>
  if (!portalUser) return <Navigate to="/portal/login" replace />
  return children
}

function PortalAppContent() {
  const { portalUser, loading } = usePortalAuth()

  if (loading) return null

  return (
    <Routes>
      <Route path="login" element={!portalUser ? <PortalLogin /> : <Navigate to="/portal/overview" />} />
      
      <Route path="/" element={<Navigate to="/portal/overview" />} />

      <Route path="*" element={
        <PortalProtectedRoute>
          <PortalShell>
            <Routes>
              <Route path="overview" element={<PortalProject />} />
              <Route path="approvals" element={<PortalApprovals />} />
              <Route path="documents" element={<PortalDocuments />} />
              <Route path="snags" element={<PortalSnags />} />
              <Route path="payments" element={<PortalPayments />} />
            </Routes>
          </PortalShell>
        </PortalProtectedRoute>
      } />
    </Routes>
  )
}

export default function PortalApp() {
  return (
    <PortalAuthProvider>
      <PortalAppContent />
    </PortalAuthProvider>
  )
}
