import React, { createContext, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function restoreSession() {
      try {
        const response = await api.get('/auth/me');
        if (response.data.success) {
          setUser(response.data.data.user);
        } else {
          setUser(null);
        }
      } catch (error) {
        // Axios interceptor already handles 401 and token refreshes.
        // If it still fails here, the session is dead.
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    // Attempt to restore session if token exists
    const token = localStorage.getItem('crm_access_token');
    if (token) {
      restoreSession();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password, tenantSlug) => {
    try {
      const response = await api.post('/auth/login', { email, password, tenantSlug });
      if (response.data.success) {
        localStorage.setItem('crm_access_token', response.data.data.accessToken);
        setUser(response.data.data.user);
        return { success: true };
      }
      return { success: false, message: 'Unknown login error' };
    } catch (error) {
      const message = error.response?.data?.error?.message || 
                      error.response?.data?.error || 
                      'Login failed. Please check your credentials.';
      return { success: false, message };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Server-side logout failed:', error);
    } finally {
      // Regardless of server response, terminate local session
      localStorage.removeItem('crm_access_token');
      setUser(null);
      navigate('/login');
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
