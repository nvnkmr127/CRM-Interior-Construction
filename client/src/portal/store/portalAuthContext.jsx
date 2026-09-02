/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'

const PortalAuthCtx = createContext(null)

export function PortalAuthProvider({ children }) {
  const [portalUser, setPortalUser]   = useState(null)   // { clientName, projectId, name }
  const [loading,    setLoading]      = useState(true)
  const navigate = useNavigate()

  // On mount: try to restore session via /api/portal/project only if saved token exists
  useEffect(() => {
    const savedToken = localStorage.getItem('portalToken')
    if (!savedToken) {
      setPortalUser(null)
      setLoading(false)
      return
    }

    api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`
    api.get('/portal/project')
      .then(res => setPortalUser({
        clientName: res.data.data?.client_name,
        projectId:  res.data.data?.id,
        name: res.data.data?.name || res.data.data?.client_name
      }))
      .catch(() => {
        localStorage.removeItem('portalToken')
        delete api.defaults.headers.common['Authorization']
        setPortalUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (phone, otp, tenantSlug) => {
    const res = await api.post('/portal/auth/verify-otp', { phone, otp, tenantSlug })
    const { projectId, clientName, portalToken } = res.data.data
    if (portalToken) {
      localStorage.setItem('portalToken', portalToken)
      api.defaults.headers.common['Authorization'] = `Bearer ${portalToken}`
    }
    setPortalUser({ clientName, projectId, name: clientName })
    return { projectId, clientName }
  }, [])

  const logout = useCallback(async () => {
    try { await api.post('/portal/auth/logout') } catch {/* ignore */}
    localStorage.removeItem('portalToken')
    delete api.defaults.headers.common['Authorization']
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
