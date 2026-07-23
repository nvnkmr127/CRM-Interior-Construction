/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function restoreSession() {
      // Dev-only mock session bypass — stripped in production builds
      if (import.meta.env.DEV) {
        const mockSession = localStorage.getItem('mockSession');
        if (mockSession) {
          setUser(JSON.parse(mockSession));
          setLoading(false);
          return;
        }
      }

      try {
        const response = await api.get('/auth/me');
        if (response.data.success) {
          setUser(response.data.data.user);
        } else {
          setUser(null);
        }
      } catch (error) {
        // Axios interceptor handles 401 and token refreshes.
        // Don't wipe session on network errors or 5xx server errors
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    }

    // Attempt to restore session
    // We rely on the /auth/me endpoint which checks the httpOnly cookie
    restoreSession();
  }, []);

  const login = useCallback(async (email, password, tenantSlug) => {
    // Dev-only mock login bypass — stripped in production builds
    if (import.meta.env.DEV && email === 'admin@mock.com' && password === 'password') {
      const mockUser = {
        id: 'mock-123',
        name: 'Mock Admin',
        email: 'admin@mock.com',
        avatar_url: null,
        role: {
          id: 'role-mock',
          name: 'superadmin',
          permissions: ['*']
        }
      };
      setUser(mockUser);
      localStorage.setItem('mockSession', JSON.stringify(mockUser));
      return { success: true };
    }

    try {
      const response = await api.post('/auth/login', { email, password, tenantSlug });
      if (response.data.success) {
        const payload = response.data.data;
        if (payload.mfaRequired || payload.passwordExpired) {
          return { success: true, payload };
        }
        setUser(payload.user);
        return { success: true, payload };
      }
      return { success: false, message: 'Unknown login error' };
    } catch (error) {
      const message = error.response?.data?.error?.message || 
                      error.response?.data?.error || 
                      'Login failed. Please check your credentials.';
      return { success: false, message };
    }
  }, []);

  const logout = useCallback(async () => {
    // Dev-only mock logout bypass — stripped in production builds
    if (import.meta.env.DEV && localStorage.getItem('mockSession')) {
      localStorage.removeItem('mockSession');
      setUser(null);
      navigate('/login');
      return;
    }

    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Server-side logout failed:', error);
    } finally {
      // Regardless of server response, terminate local session
      setUser(null);
      navigate('/login');
    }
  }, [navigate]);

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout
  }), [user, loading, login, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
