import React, { createContext, useContext, useState, useEffect } from 'react';

const PortalAuthContext = createContext(null);

export function PortalAuthProvider({ children }) {
  const [clientName, setClientName] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/portal/project');
      const data = await res.json();
      if (res.ok && data.success) {
        setClientName(data.data.client_name);
        setProjectId(data.data.id);
      } else {
        setClientName(null);
        setProjectId(null);
      }
    } catch (e) {
      setClientName(null);
      setProjectId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (phone, otp, tenantSlug) => {
    const res = await fetch('/api/portal/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp, tenantSlug })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      setClientName(data.data.clientName);
      setProjectId(data.data.projectId);
      return true;
    }
    throw new Error(data.message || 'Login failed');
  };

  const logout = async () => {
    try {
      await fetch('/api/portal/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setClientName(null);
      setProjectId(null);
      window.location.href = '/portal/login';
    }
  };

  return (
    <PortalAuthContext.Provider value={{ clientName, projectId, loading, login, logout }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  return useContext(PortalAuthContext);
}
