import { Routes, Route, Navigate } from 'react-router-dom'
import { PortalAuthProvider, usePortalAuth } from './store/portalAuthContext'
import PortalShell from './components/PortalShell'
import PortalLogin from './pages/PortalLogin'
import PortalProject from './pages/PortalProject'
import PortalApprovals from './pages/PortalApprovals'
import PortalDesignAssets from './pages/PortalDesignAssets'
import PortalDesignReviews from './pages/PortalDesignReviews'
import PortalMaterialPalettes from './pages/PortalMaterialPalettes'
import PortalSnags from './pages/PortalSnags'
import PortalDocuments from './pages/PortalDocuments'
import PortalPayments from './pages/PortalPayments'
import PortalChangeOrders from './pages/PortalChangeOrders'
import PortalMaterialApprovals from './pages/PortalMaterialApprovals'
import PortalTimeline from './pages/PortalTimeline'
import PortalMeetingNotes from './pages/PortalMeetingNotes'
import PortalPunchList from './pages/PortalPunchList'
import PortalHandover from './pages/PortalHandover'
import PortalWarranties from './pages/PortalWarranties'
import PortalAmcs from './pages/PortalAmcs'
import PortalClaims from './pages/PortalClaims'
import PortalQuotations from './pages/PortalQuotations'




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
              <Route path="timeline" element={<PortalTimeline />} />
              <Route path="approvals" element={<PortalApprovals />} />
              <Route path="design-concepts" element={<PortalDesignAssets />} />
              <Route path="design-reviews" element={<PortalDesignReviews />} />
              <Route path="material-palettes" element={<PortalMaterialPalettes />} />
              <Route path="material-approvals" element={<PortalMaterialApprovals />} />
              <Route path="change-orders" element={<PortalChangeOrders />} />
              <Route path="documents" element={<PortalDocuments />} />
              <Route path="meeting-notes" element={<PortalMeetingNotes />} />
              <Route path="snags" element={<PortalSnags />} />
              <Route path="punch-list" element={<PortalPunchList />} />
              <Route path="handover" element={<PortalHandover />} />
              <Route path="payments" element={<PortalPayments />} />
              <Route path="warranties" element={<PortalWarranties />} />
              <Route path="amcs" element={<PortalAmcs />} />
              <Route path="claims" element={<PortalClaims />} />
              <Route path="quotations" element={<PortalQuotations />} />



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
