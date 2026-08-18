/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { loadMockDatabase } from '../api/mockData';
import { ROLE_DEFAULTS } from '../constants/roleDefaults';

const AuthContext = createContext();

export const DEFAULT_MOCK_TEAM = {
  id: 'mock-user-1',
  name: 'Rahul K. (Sales)',
  email: 'team@mock.com',
  password: 'password',
  avatar_url: null,
  role: { 
    id: 'sales_rep', 
    name: 'Sales Representative', 
    permissions: [
      'leads:view', 'leads:create', 'leads:edit',
      'projects:view',
      'chat:view'
    ],
    enabled_modules: ['leads', 'projects', 'chat'] 
  }
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
    // Force-sync active session permissions/modules if logged in as sales_rep
    try {
      const activeSession = localStorage.getItem('mockSession');
      if (activeSession) {
        const parsed = JSON.parse(activeSession);
        if (parsed?.role?.id === 'sales_rep' || parsed?.role?.name?.toLowerCase() === 'sales representative') {
          const defaults = ROLE_DEFAULTS['Sales Representative'];
          parsed.role.permissions = defaults.permissions;
          parsed.role.enabled_modules = defaults.enabled_modules;
          parsed.role.name = 'Sales Representative';
          localStorage.setItem('mockSession', JSON.stringify(parsed));
        }
      }
    } catch (e) {}

    async function restoreSession() {
      // Dev-only mock session bypass — disabled to enforce real-time session
      if (false) {
        const mockSession = localStorage.getItem('mockSession');
        if (mockSession) {
          try {
            const parsedSession = JSON.parse(mockSession);
            const mockDatabase = JSON.parse(localStorage.getItem('mockDatabase_v4') || '{}');
            const usersList = mockDatabase.users || [];
            const currentUserObj = usersList.find(u => u.id === parsedSession.id || u.email === parsedSession.email);
            if (currentUserObj) {
              const rolesList = mockDatabase.roles || [];
              const userRoleVal = currentUserObj.role_id || currentUserObj.role;
              const r = rolesList.find(role => role.id === userRoleVal || role.name === userRoleVal);
              
              const roleKey = Object.keys(ROLE_DEFAULTS).find(
                key => key.toLowerCase() === (currentUserObj.role_name || '').toLowerCase() || 
                       key.toLowerCase() === (userRoleVal || '').toLowerCase()
              );
              const defaults = roleKey ? ROLE_DEFAULTS[roleKey] : null;
              
              let permissions = defaults?.permissions || [];
              let enabled_modules = defaults?.enabled_modules || ['projects', 'tasks', 'leads', 'dashboards'];
              
              if (r) {
                permissions = r.permissions || [];
                enabled_modules = r.enabled_modules || [];
              }
              
              // Force override for sales_rep to ensure strict permissions even if old cache exists
              if (userRoleVal === 'sales_rep' || (currentUserObj.role_name || '').toLowerCase() === 'sales representative') {
                 permissions = defaults?.permissions || [];
                 enabled_modules = defaults?.enabled_modules || ['leads', 'projects', 'chat'];
              }

              const updatedMockUser = {
                ...parsedSession,
                name: currentUserObj.name,
                email: currentUserObj.email,
                avatar_url: currentUserObj.avatar_url || null,
                role: {
                  id: userRoleVal,
                  name: currentUserObj.role_name || userRoleVal,
                  permissions,
                  enabled_modules
                }
              };
              setUser(updatedMockUser);
              localStorage.setItem('mockSession', JSON.stringify(updatedMockUser));
              window.dispatchEvent(new Event('app:auth-change'));
              setLoading(false);
              return;
            }
          } catch (e) {
            console.error("Failed to restore dynamic mock session", e);
          }
          setUser(JSON.parse(mockSession));
          setLoading(false);
          return;
        }
      }

      // Attempt to restore session
      // We rely on the /auth/me endpoint which checks the httpOnly cookie
      if (!localStorage.getItem('isAuthenticated')) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/auth/me');
        if (response.data.success) {
          setUser(response.data.data.user);
        } else {
          localStorage.removeItem('isAuthenticated');
          setUser(null);
        }
      } catch (error) {
        // Axios interceptor handles 401 and token refreshes.
        // Don't wipe session on network errors or 5xx server errors
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          localStorage.removeItem('isAuthenticated');
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    }

    // Attempt to restore session
    // We rely on the /auth/me endpoint which checks the httpOnly cookie
    restoreSession();

    const handleStorageChange = (e) => {
      if (e.key === 'mockSession') {
        if (e.newValue) {
          try {
            setUser(JSON.parse(e.newValue));
          } catch (err) {}
        } else {
          setUser(null);
        }
      }
    };
    
    const handleAppLogout = () => {
      localStorage.removeItem('isAuthenticated');
      setUser(null);
      navigate('/login');
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('app:logout', handleAppLogout);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('app:logout', handleAppLogout);
    };
  }, [navigate]);

  const login = useCallback(async (email, password, tenantSlug) => {
    // Dev-only mock login bypass — disabled to enforce real-time session
    if (false) {
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
      } else if (email === 'sales@mock.com' && password === 'password') {
        const mockUser = {
          id: 'mock-user-2',
          name: 'Amit S.',
          email: 'sales@mock.com',
          avatar_url: null,
          role: {
            id: 'sales_rep',
            name: 'Sales Representative',
            permissions: [
              'leads:view', 'leads:create', 'leads:edit',
              'projects:view',
              'chat:view'
            ],
            enabled_modules: ['leads', 'projects', 'chat']
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
          const roleKey = Object.keys(ROLE_DEFAULTS).find(
            key => key.toLowerCase() === (foundUser.role_name || '').toLowerCase() || 
                   key.toLowerCase() === (matchedRole || '').toLowerCase()
          );
          const defaults = roleKey ? ROLE_DEFAULTS[roleKey] : null;
          
          const rolesList = mockDatabase.roles || [];
          const r = rolesList.find(role => role.id === matchedRole || role.name === foundUser.role_name);
          
          let permissions = defaults?.permissions || [];
          let enabled_modules = defaults?.enabled_modules || ['projects', 'tasks', 'leads', 'dashboards'];
          
          if (r) {
            permissions = r.permissions || [];
            enabled_modules = r.enabled_modules || [];
          }
          
          // Force override for sales_rep to ensure strict permissions even if old cache exists
          if (matchedRole === 'sales_rep' || (foundUser.role_name || '').toLowerCase() === 'sales representative') {
             permissions = defaults?.permissions || [];
             enabled_modules = defaults?.enabled_modules || ['leads', 'projects', 'chat'];
          }

          const roleObj = {
            id: matchedRole || 'pm',
            name: foundUser.role_name || 'Project Manager',
            permissions,
            enabled_modules
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
          window.dispatchEvent(new Event('app:auth-change'));
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
        localStorage.setItem('isAuthenticated', 'true');
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
    // Dev-only mock logout bypass — disabled to enforce real-time session
    if (false) {
      localStorage.removeItem('mockSession');
      setUser(null);
      window.dispatchEvent(new Event('app:auth-change'));
      navigate('/login');
      return;
    }

    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Server-side logout failed:', error);
    } finally {
      // Regardless of server response, terminate local session
      localStorage.removeItem('isAuthenticated');
      setUser(null);
      navigate('/login');
    }
  }, [navigate]);

  const updateUser = useCallback((updatedFields) => {
    setUser(prev => {
      if (!prev) return null;
      const newUser = { ...prev, ...updatedFields };
      if (false) {
        localStorage.setItem('mockSession', JSON.stringify(newUser));
        try {
          const mockDatabase = JSON.parse(localStorage.getItem('mockDatabase_v4') || '{}');
          if (mockDatabase.users) {
            const idx = mockDatabase.users.findIndex(u => u.id === prev.id || u.email === prev.email);
            if (idx !== -1) {
              mockDatabase.users[idx] = {
                ...mockDatabase.users[idx],
                ...updatedFields,
                phone: updatedFields.phone !== undefined ? updatedFields.phone : mockDatabase.users[idx].phone,
                designation: updatedFields.designation !== undefined ? updatedFields.designation : mockDatabase.users[idx].designation
              };
              if (updatedFields.designation) {
                mockDatabase.users[idx].role_name = updatedFields.designation;
              }
              localStorage.setItem('mockDatabase_v4', JSON.stringify(mockDatabase));
            }
          }
        } catch (e) {}
      }
      return newUser;
    });
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    updateUser
  }), [user, loading, login, logout, updateUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    return { user: null, loading: false, isAuthenticated: false };
  }
  return context;
};
