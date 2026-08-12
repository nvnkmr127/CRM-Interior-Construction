/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { loadMockDatabase } from '../api/mockData';

const AuthContext = createContext();

export const DEFAULT_MOCK_TEAM = {
  id: 'mock-user-1',
  name: 'Rahul K. (PM)',
  email: 'team@mock.com',
  password: 'password',
  avatar_url: null,
  role: { id: 'pm', name: 'Project Manager', permissions: ['projects:view', 'projects:edit', 'dashboard:view'], enabled_modules: ['projects', 'tasks', 'dashboards'] }
};

export const getMockTeamCredentials = () => {
  const saved = localStorage.getItem('mock_team_credentials');
  if (saved) {
    try { 
      const parsed = JSON.parse(saved);
      if (parsed && parsed.email) {
        if (!parsed.role || typeof parsed.role !== 'object') {
          parsed.role = { 
            id: 'pm', 
            name: 'Project Manager', 
            permissions: ['*'], 
            enabled_modules: ['projects', 'tasks', 'leads', 'dashboards', 'analytics', 'settings'] 
          };
        } else {
          if (!parsed.role.enabled_modules || parsed.role.enabled_modules.length === 0) {
            parsed.role.enabled_modules = ['projects', 'tasks', 'leads', 'dashboards', 'analytics', 'settings'];
          }
          if (!parsed.role.permissions) {
            parsed.role.permissions = ['*'];
          }
          if (!parsed.role.name && parsed.role.id) {
            const matched = DEFAULT_ROLE_OPTIONS.find(d => d.value === parsed.role.id);
            parsed.role.name = matched ? matched.label : parsed.role.id;
          }
        }
        return parsed; 
      }
    } catch (e) {}
  }
  return DEFAULT_MOCK_TEAM;
};

export const updateMockTeamCredentials = (data) => {
  localStorage.setItem('mock_team_credentials', JSON.stringify({
    ...getMockTeamCredentials(),
    ...data
  }));
};

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
    if (import.meta.env.DEV) {
      if (email === 'admin@mock.com' && password === 'password') {
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
      } else {
        // Authenticate against users in mock database
        const mockDatabase = loadMockDatabase();
        const usersList = mockDatabase.users || [];
        const foundUser = usersList.find(u => u.email === email && (u.password === password || password === 'password'));
        
        if (foundUser) {
          const matchedRole = foundUser.role_id || foundUser.role;
          const roleObj = {
            id: matchedRole || 'pm',
            name: foundUser.role_name || 'Project Manager',
            permissions: ['*'],
            enabled_modules: ['projects', 'tasks', 'leads', 'dashboards', 'analytics', 'settings']
          };

          const mockUser = {
            id: foundUser.id,
            name: foundUser.name,
            email: foundUser.email,
            avatar_url: foundUser.avatar_url || null,
            role: roleObj
          };
          setUser(mockUser);
          localStorage.setItem('mockSession', JSON.stringify(mockUser));
          return { success: true };
        }

        // Fallback to mockTeam credentials
        const mockTeam = getMockTeamCredentials();
        if (email === mockTeam.email && password === mockTeam.password) {
          const mockUser = {
            id: mockTeam.id,
            name: mockTeam.name,
            email: mockTeam.email,
            avatar_url: mockTeam.avatar_url,
            role: mockTeam.role
          };
          setUser(mockUser);
          localStorage.setItem('mockSession', JSON.stringify(mockUser));
          return { success: true };
        }
      }
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
