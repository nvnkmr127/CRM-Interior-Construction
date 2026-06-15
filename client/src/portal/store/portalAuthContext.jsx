import { createContext, useContext, useState, useEffect } from 'react'

const PortalAuthContext = createContext()

export function PortalAuthProvider({ children }) {
  const [portalUser, setPortalUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing session/token here
    const token = localStorage.getItem('portal_token')
    if (token) {
      // Mock validation
      setTimeout(() => {
        setPortalUser({ id: 'client1', name: 'Rajesh Sharma', phone: '9876543210', projectId: 'proj1' })
        setLoading(false)
      }, 500)
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (phone, otp) => {
    // Mock login
    return new Promise((resolve) => {
      setTimeout(() => {
        localStorage.setItem('portal_token', 'mock_token')
        setPortalUser({ id: 'client1', name: 'Rajesh Sharma', phone, projectId: 'proj1' })
        resolve(true)
      }, 800)
    })
  }

  const logout = () => {
    localStorage.removeItem('portal_token')
    setPortalUser(null)
  }

  return (
    <PortalAuthContext.Provider value={{ portalUser, loading, login, logout }}>
      {children}
    </PortalAuthContext.Provider>
  )
}

export const usePortalAuth = () => useContext(PortalAuthContext)
