import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'

const PortalAuthCtx = createContext(null)

export function PortalAuthProvider({ children }) {
  const [portalUser, setPortalUser]   = useState(null)   // { clientName, projectId }
  const [loading,    setLoading]      = useState(true)
  const navigate = useNavigate()

  // On mount: try to restore session via /api/portal/project
  useEffect(() => {
    api.get('/portal/project')
      .then(res => setPortalUser({
        clientName: res.data.data?.client_name,
        projectId:  res.data.data?.id,
      }))
      .catch(() => setPortalUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (phone, otp, tenantSlug) => {
    const res = await api.post('/portal/auth/verify-otp', { phone, otp, tenantSlug })
    const { projectId, clientName } = res.data.data
    setPortalUser({ clientName, projectId })
    return { projectId, clientName }
  }, [])

  const logout = useCallback(async () => {
    try { await api.post('/portal/auth/logout') } catch {/* ignore */}
    setPortalUser(null)
    navigate('/portal/login')
  }, [navigate])

  return (
    <PortalAuthCtx.Provider value={{ portalUser, loading, login, logout, isAuthenticated: !!portalUser }}>
      {children}
    </PortalAuthCtx.Provider>
  )
}

export const usePortalAuth = () => useContext(PortalAuthCtx)
