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

export const DEFAULT_ROLE_OPTIONS = [
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'pm', label: 'Project Manager' },
  { value: 'designer', label: 'Designer' },
  { value: 'lead_designer', label: 'Lead Designer' },
  { value: 'junior_designer', label: 'Junior Designer' },
  { value: 'sales', label: 'Sales' },
  { value: 'sales_rep', label: 'Sales Representative' },
  { value: 'site_supervisor', label: 'Site Supervisor' },
  { value: 'site_engineer', label: 'Site Engineer' },
  { value: 'accountant', label: 'Accountant' }
];

export const getMockTeamCredentials = () => {
  const saved = localStorage.getItem('mock_team_credentials');
  if (saved) {
    try { 
      const parsed = JSON.parse(saved);
      if (parsed && parsed.email) {
        if (!parsed.role || typeof parsed.role !== 'object') {
          const rKey = parsed.role || 'designer';
          const rConfig = ROLE_DEFAULTS[rKey] || ROLE_DEFAULTS['Designer'];
          parsed.role = { 
            id: rKey, 
            name: rConfig?.name || 'Designer', 
            permissions: rConfig?.permissions || ['projects:view', 'tasks:view'], 
            enabled_modules: rConfig?.enabled_modules || ['projects', 'tasks'] 
          };
        } else {
          if (!parsed.role.enabled_modules || parsed.role.enabled_modules.length === 0) {
            const rKey = Object.keys(ROLE_DEFAULTS).find(k => k.toLowerCase() === (parsed.role.id || parsed.role.name || '').toLowerCase()) || 'Designer';
            parsed.role.enabled_modules = ROLE_DEFAULTS[rKey]?.enabled_modules || ['projects', 'tasks'];
            parsed.role.permissions = ROLE_DEFAULTS[rKey]?.permissions || ['projects:view', 'tasks:view'];
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
          if (response.data.data.accessToken) {
            api.defaults.headers.common['Authorization'] = `Bearer ${response.data.data.accessToken}`;
          }
        } else {
          localStorage.removeItem('isAuthenticated');
          delete api.defaults.headers.common['Authorization'];
          setUser(null);
        }
      } catch (error) {
        // Axios interceptor handles 401 and token refreshes.
        // Don't wipe session on network errors or 5xx server errors
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          localStorage.removeItem('isAuthenticated');
          delete api.defaults.headers.common['Authorization'];
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
      if (e.key === 'last_role_update') {
        handleConfigUpdate();
      }
    };
    
    const handleAppLogout = () => {
      localStorage.removeItem('isAuthenticated');
      setUser(null);
      navigate('/login');
    };

    const handleConfigUpdate = () => {
      api.get('/auth/me').then(res => {
        if (res.data?.success) {
          setUser(res.data.data.user);
        }
      }).catch(() => {});
    };

    const handleRoleUpdated = (e) => {
      const updatedRole = e.detail;
      if (updatedRole) {
        setUser(prev => {
          if (!prev) return prev;
          const userRoleId = prev.role?.id;
          const userRoleName = prev.role?.name?.toLowerCase();
          const targetRoleId = updatedRole.id;
          const targetRoleName = updatedRole.name?.toLowerCase();

          if (userRoleId === targetRoleId || userRoleName === targetRoleName) {
            const rawPerms = updatedRole.permissions;
            const newPerms = Array.isArray(rawPerms) ? rawPerms : (rawPerms?.actions || []);
            const newMods = Array.isArray(updatedRole.enabled_modules) ? updatedRole.enabled_modules : (rawPerms?.modules || []);
            return {
              ...prev,
              role: {
                ...prev.role,
                name: updatedRole.name || prev.role.name,
                permissions: newPerms,
                enabled_modules: newMods,
                data_scopes: updatedRole.data_scopes || prev.role.data_scopes,
                field_permissions: updatedRole.field_permissions || prev.role.field_permissions,
                page_permissions: updatedRole.page_permissions || prev.role.page_permissions
              }
            };
          }
          return prev;
        });
      }
      handleConfigUpdate();
    };

    let channel = null;
    try {
      channel = new BroadcastChannel('crm_admin_sync');
      channel.onmessage = () => {
        handleConfigUpdate();
      };
    } catch (e) {}

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('app:logout', handleAppLogout);
    window.addEventListener('app:sidebar-config-updated', handleConfigUpdate);
    window.addEventListener('app:tenant-updated', handleConfigUpdate);
    window.addEventListener('app:auth-change', handleConfigUpdate);
    window.addEventListener('app:role-updated', handleRoleUpdated);
    window.addEventListener('focus', handleConfigUpdate);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('app:logout', handleAppLogout);
      window.removeEventListener('app:sidebar-config-updated', handleConfigUpdate);
      window.removeEventListener('app:tenant-updated', handleConfigUpdate);
      window.removeEventListener('app:auth-change', handleConfigUpdate);
      window.removeEventListener('app:role-updated', handleRoleUpdated);
      window.removeEventListener('focus', handleConfigUpdate);
      if (channel) {
        try { channel.close(); } catch (e) {}
      }
    };
  }, [navigate]);

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data.success) {
        setUser(response.data.data.user);
        return response.data.data.user;
      }
    } catch (e) {
      console.error('Failed to refresh user session:', e);
    }
    return null;
  }, []);

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
      const cleanEmail = (email || '').trim();
      const cleanSlug = (tenantSlug || '').trim();
      const response = await api.post('/auth/login', { email: cleanEmail, password, tenantSlug: cleanSlug });
      if (response.data.success) {
        const payload = response.data.data;
        if (payload.mfaRequired || payload.passwordExpired) {
          return { success: true, payload };
        }
        if (payload.accessToken) {
          api.defaults.headers.common['Authorization'] = `Bearer ${payload.accessToken}`;
        }
        localStorage.setItem('isAuthenticated', 'true');
        try {
          const meResponse = await api.get('/auth/me');
          if (meResponse.data.success) {
            setUser(meResponse.data.data.user);
          } else {
            setUser(payload.user);
          }
        } catch (meError) {
          setUser(payload.user);
        }
        return { success: true, payload };
      }
      return { success: false, message: 'Unknown login error' };
    } catch (error) {
      if (error.response?.status === 502 || error.response?.status === 503 || error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        return { success: false, message: 'Server is starting or unavailable (502 Bad Gateway). Please wait 2 seconds and try again.' };
      }
      const message = error.response?.data?.error?.message || 
                      error.response?.data?.message ||
                      error.response?.data?.error || 
                      'Invalid email or password. Please try again.';
      return { success: false, message };
    }
  }, []);

  const logout = useCallback(async () => {
    // Dev-only mock logout bypass — disabled to enforce real-time session
    if (false) {
      localStorage.removeItem('mockSession');
      localStorage.removeItem('isAuthenticated');
      delete api.defaults.headers.common['Authorization'];
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
      localStorage.removeItem('mockSession');
      delete api.defaults.headers.common['Authorization'];
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
    setUser,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    updateUser,
    refreshUser
  }), [user, loading, login, logout, updateUser, refreshUser]);

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
