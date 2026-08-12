import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import layoutStyles from './ConfigLayout.module.css'
import { Button, Badge, Modal, DataTable, Avatar, Input, Select, EmptyState, PermissionButton } from '../../components/ui'
import AddTeamMemberForm from './AddTeamMemberForm'
import EmployeeApprovalModal from './EmployeeApprovalModal'
import StatusManagerModal, { STATUS_COLORS } from './StatusManagerModal'
import BulkUserModals from './BulkUserModals'
import EmailLogsTab from './EmailLogsTab'
import { useToast } from '../../store/toastContext'
import { SearchFilterBar, AdvancedImportExportModal } from '../../components/ui'
import OffboardingDashboard from '../../components/offboarding/OffboardingDashboard'

import InitiateOffboardingModal from '../../components/offboarding/InitiateOffboardingModal'
import ContextMenu from '../../components/ui/ContextMenu'
import UserGridCard from '../../components/ui/UserGridCard'
import AIInsightsPanel from '../../components/ui/AIInsightsPanel'
import api from '../../api/axios'
import EmployeeProfilePage from './EmployeeProfilePage'
import EffectivePermissionViewer from './EffectivePermissionViewer'
import PermissionAssignmentModal from './PermissionAssignmentModal'
import { getMockTeamCredentials, updateMockTeamCredentials } from '../../store/authContext'

import { useConfirm } from '../../store/confirmContext';

const DEFAULT_ROLE_OPTIONS = [
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'pm', label: 'Project Manager' },
  { value: 'designer', label: 'Designer' },
  { value: 'sales', label: 'Sales' }
]

export default function UsersManager() {
  const { confirm } = useConfirm();

  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [roleChangeTarget, setRoleChangeTarget] = useState(null)
  const [statusChangeTarget, setStatusChangeTarget] = useState(null)
  const [approvalTarget, setApprovalTarget] = useState(null)
  const [activeTab, setActiveTab] = useState('directory')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkModalType, setBulkModalType] = useState(null) // 'role', 'status', 'add'
  const [showImportExport, setShowImportExport] = useState(false)
  const [offboardingTarget, setOffboardingTarget] = useState(null)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('users_view_mode') || 'table')
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('users_visible_cols')
    return saved ? JSON.parse(saved) : ['user', 'role', 'status', 'lastActive', 'actions']
  })
  const [contextMenu, setContextMenu] = useState(null)
  const [effectivePermUserTarget, setEffectivePermUserTarget] = useState(null)
  const [assignPermUserTarget, setAssignPermUserTarget] = useState(null)
  
  const [isMockConfigOpen, setIsMockConfigOpen] = useState(false)
  const [mockConfigData, setMockConfigData] = useState({})
  const [refreshKey, setRefreshKey] = useState(0)

  const toast = useToast()

  const [roles, setRoles] = useState([])
  const [departments, setDepartments] = useState([])
  const [branches, setBranches] = useState([])
  const [filters, setFilters] = useState({})
  const [injectedUsers, setInjectedUsers] = useState([])
  
  const allUsers = [...injectedUsers, ...users].filter((v, i, a) => a.findIndex(v2 => v2.id === v.id) === i)

  const roleOptions = roles.length > 0 
    ? [
        ...roles.map(r => ({ value: r.id, label: r.name })),
        ...DEFAULT_ROLE_OPTIONS.filter(d => !roles.some(r => r.id === d.value || r.name.toLowerCase() === d.label.toLowerCase()))
      ]
    : DEFAULT_ROLE_OPTIONS

  
  useEffect(() => {
    localStorage.setItem('users_view_mode', viewMode)
  }, [viewMode])

  useEffect(() => {
    localStorage.setItem('users_visible_cols', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setIsAddMemberOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        document.querySelector('input[type="text"]')?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  
  const [nlpLoading, setNlpLoading] = useState(false);
  const handleNLPSearch = async (query) => {
    if (!query) {
      setFilters(prev => ({...prev, search: ''}));
      fetchUsers({...filters, search: ''});
      return;
    }
    setNlpLoading(true);
    try {
      const res = await api.post('/users/ai/search', { query });
      const ids = res.data?.data?.matchingIds || [];
      // Hacky way to filter client-side since API doesn't support array of IDs right now
      // Or we can just let standard search run if NLP returns nothing
      if (ids.length > 0) {
        setUsers(prev => prev.filter(u => ids.includes(u.id)));
      } else {
        fetchUsers({...filters, search: query});
      }
    } catch(e) {
      fetchUsers({...filters, search: query});
    } finally {
      setNlpLoading(false);
    }
  };

  const fetchUsers = (currentFilters = filters) => {
    const params = new URLSearchParams()
    Object.keys(currentFilters).forEach(k => {
      if (currentFilters[k]) params.append(k, currentFilters[k])
    })
    params.append('_t', Date.now())
    api.get(`/users?${params.toString()}`)
      .then(res => { 
        const r = res.data?.data || res.data; 
        console.log("FETCHED USERS:", r);
        setUsers(Array.isArray(r) ? r : []); 
      })
      .catch(() => setUsers([]))
  }

  useEffect(() => {
    api.get('/roles')
      .then(res => { const r = res.data?.data || res.data; setRoles(Array.isArray(r) ? r : []); })
      .catch(() => setRoles([]))
    
    api.get('/org/departments')
      .then(res => { const r = res.data?.data || res.data; setDepartments(Array.isArray(r) ? r : []); })
      .catch(() => setDepartments([]))

    api.get('/org/branches')
      .then(res => { const r = res.data?.data || res.data; setBranches(Array.isArray(r) ? r : []); })
      .catch(() => setBranches([]))
  }, [])

  const handleBulkDelete = async () => {
    if (!await confirm(`WARNING: Are you sure you want to permanently delete ${selectedIds.size} users? This action cannot be undone.`)) return;
    try {
      await api.delete('/users/bulk/delete', { data: { userIds: Array.from(selectedIds) } })
      toast.success('Users deleted')
      setSelectedIds(new Set())
      fetchUsers()
    } catch {
      toast.error('Failed to delete users')
    }
  }

  const handleBulkPasswordReset = async () => {
    if (!await confirm(`Are you sure you want to send password reset emails to ${selectedIds.size} users?`)) return;
    try {
      await api.post('/users/bulk/reset-password', { userIds: Array.from(selectedIds) })
      toast.success('Password reset emails sent')
      setSelectedIds(new Set())
    } catch {
      toast.error('Failed to send password resets')
    }
  }

  const handleBulkExport = () => {
    setShowImportExport(true)
  }

  const confirmRoleChange = async () => {
    if (!roleChangeTarget) return
    setUsers(prev => prev.map(u => u.id === roleChangeTarget.user.id ? { ...u, role: roleChangeTarget.newRole } : u))
    try {
      await api.patch(`/users/${roleChangeTarget.user.id}`, { role: roleChangeTarget.newRole })
      toast.success(`${roleChangeTarget.user.name}'s role updated`)
    } catch {
      setUsers(prev => prev.map(u => u.id === roleChangeTarget.user.id ? { ...u, role: roleChangeTarget.user.role } : u))
      toast.error('Failed to update role')
    }
    setRoleChangeTarget(null)
  }

  const columns = [
    {
      key: 'user', label: 'User', width: '25%',
      render: (u) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={async () => setSelectedUserId(u.id)}>
          <Avatar name={u.name || '?'} size="sm" />
          <div>
            <div style={{ fontWeight: 500, color: 'var(--color-primary)', textDecoration: 'underline' }}>{u.name || 'Unknown User'}</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{u.email || '-'}</div>
          </div>
        </div>
      )
    },
    {
      key: 'role', label: 'Role', width: '15%',
      render: (u) => {
        const roleLabel = u.role_name || roleOptions.find(r => r.value === u.role)?.label || u.role || 'No Role'
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Badge variant="neutral">{roleLabel}</Badge>
          </div>
        )
      }
    },
    {
      key: 'status', label: 'Status', width: '15%',
      render: (u) => {
        const statusVal = u.status || 'inactive'
        return <Badge variant={STATUS_COLORS[statusVal] || 'neutral'}>{statusVal.toUpperCase().replace('_', ' ')}</Badge>
      }
    },
    {
      key: 'lastActive', label: 'Last Active', width: '15%',
      render: (u) => u.lastActive ? new Date(u.lastActive).toLocaleString() : <span style={{color:'var(--color-text-muted)'}}>Never</span>
    },
    {
      key: 'actions', label: 'Actions', align: 'right', width: '380px',
      render: (u) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'flex-end' }}>
          {u.status === 'pending_approval' || u.status === 'changes_requested' ? (
            <Button variant="secondary" onClick={async () => setApprovalTarget(u)}>Review</Button>
          ) : (
            <>
              <div style={{ minWidth: '160px', textAlign: 'left' }}>
                <PermissionButton permission="users:assign_roles" asChild>
                  <Select 
                    value={u.role_id || u.role} 
                    options={roleOptions} 
                    onChange={(val) => setRoleChangeTarget({ user: u, newRole: val })}
                  />
                </PermissionButton>
              </div>

              {u.status === 'inactive' || u.status === 'archived' || u.status === 'resigned' || u.status === 'terminated' ? (
                <PermissionButton permission="users:activate_user" variant="primary" onClick={async () => {
                  if (await confirm(`Are you sure you want to reactivate ${u.name}?`)) setStatusChangeTarget(u)
                }}>
                  Reactivate
                </PermissionButton>
              ) : (
                <PermissionButton permission="users:deactivate_user" variant="danger" onClick={async () => {
                  if (await confirm(`WARNING: Deactivating ${u.name} will immediately revoke their access. Continue?`)) setOffboardingTarget(u)
                }}>
                  Deactivate
                </PermissionButton>
              )}
              
              <Button variant="ghost" onClick={async () => setEffectivePermUserTarget(u)} title="View Effective Permissions">
                <i className="ri-shield-keyhole-line" style={{ fontSize: '1.2rem', color: 'var(--color-primary)' }}></i>
              </Button>
              <Button variant="ghost" onClick={async () => setAssignPermUserTarget(u)} title="Assign Direct/Temporary Permissions">
                <i className="ri-user-settings-line" style={{ fontSize: '1.2rem', color: 'var(--color-secondary)' }}></i>
              </Button>
            </>
          )}
        </div>
      )
    }
  ]

  const renderMockConfigModal = () => {
    if (!isMockConfigOpen) return null;
    return (
      <Modal isOpen={isMockConfigOpen} title="Configure Dev Login" onClose={() => setIsMockConfigOpen(false)} size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '8px 4px' }}>
          
          <div style={{ 
            padding: '16px', 
            background: 'linear-gradient(145deg, var(--color-bg-subtle), transparent)', 
            borderRadius: '8px', 
            borderLeft: '4px solid var(--color-primary)',
            color: 'var(--color-text-muted)',
            fontSize: '0.9rem',
            lineHeight: '1.5'
          }}>
            <strong style={{ color: 'var(--color-primary)', display: 'block', marginBottom: '4px' }}>Mock Environment Override</strong>
            Configure the credentials and role that will be automatically loaded when using the <strong>Team</strong> login button in dev mode.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Input 
              label="Display Name"
              placeholder="e.g. Rahul K. (PM)"
              value={mockConfigData.name || ''} 
              onChange={e => setMockConfigData({...mockConfigData, name: e.target.value})} 
            />
            <Select 
              label="System Role"
              value={mockConfigData.role?.id || ''} 
              options={roleOptions} 
              onChange={val => {
                const roleId = val;
                const selectedRole = roles.find(r => r.id === roleId);
                if (selectedRole) {
                  setMockConfigData({...mockConfigData, role: selectedRole});
                } else {
                  const fallback = DEFAULT_ROLE_OPTIONS.find(d => d.value === roleId);
                  if (fallback) {
                    let fallbackModules = ['projects', 'tasks', 'leads', 'dashboards', 'analytics', 'settings'];
                    if (roleId === 'pm') fallbackModules = ['projects', 'tasks', 'dashboards'];
                    if (roleId === 'designer') fallbackModules = ['projects', 'tasks'];
                    if (roleId === 'sales') fallbackModules = ['leads', 'dashboards'];
                    setMockConfigData({...mockConfigData, role: { id: fallback.value, name: fallback.label, permissions: ['*'], enabled_modules: fallbackModules }});
                  }
                }
              }} 
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input 
              label="Email Address"
              type="email"
              value={mockConfigData.email || ''} 
              onChange={e => setMockConfigData({...mockConfigData, email: e.target.value})} 
            />
            <Input 
              label="Password"
              type="text"
              value={mockConfigData.password || ''} 
              onChange={e => setMockConfigData({...mockConfigData, password: e.target.value})} 
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
            <Button variant="ghost" onClick={() => setIsMockConfigOpen(false)}>Cancel</Button>
            <Button variant="primary" style={{ minWidth: '160px' }} onClick={async () => {
              updateMockTeamCredentials(mockConfigData);
              try {
                if (selectedUserId) {
                  await api.patch(`/users/${selectedUserId}`, { 
                    email: mockConfigData.email, 
                    role_id: mockConfigData.role?.id, 
                    role_name: mockConfigData.role?.name,
                    role: mockConfigData.role?.name 
                  });
                  // Also manually dispatch an event or refetch so EmployeeProfilePage can refresh
                  fetchUsers(); 
                  setRefreshKey(prev => prev + 1);
                }
              } catch (err) {
                console.error("Failed to update user profile", err);
              }
              setIsMockConfigOpen(false);
              toast.success('Dev login credentials updated! They will be used next time you log in.');
            }}>Save Configuration</Button>
          </div>
        </div>
      </Modal>
    );
  };

  if (selectedUserId) {
    return (
      <>
        <EmployeeProfilePage 
          key={`${selectedUserId}-${refreshKey}`}
          userId={selectedUserId} 
          onBack={() => setSelectedUserId(null)}
          onConfigureMock={(userToMock) => {
            const saved = getMockTeamCredentials();
            const isSameUser = saved && (saved.email === userToMock.email || saved.id === userToMock.id);
            setMockConfigData({
              name: userToMock.name,
              email: userToMock.email,
              password: isSameUser ? (saved.password || 'password') : 'password',
              role: userToMock.role ? { id: userToMock.role, name: userToMock.role_name } : null
            });
            setIsMockConfigOpen(true);
          }}
        />
        {renderMockConfigModal()}
      </>
    );
  }

  if (isAddMemberOpen) {
    return (
      <div className={layoutStyles.configSection} style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflowY: 'auto' }}>
        <div className={layoutStyles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 className={layoutStyles.sectionTitle}>Add Team Member</h2>
            <p className={layoutStyles.sectionDesc}>Create a new employee profile and set permissions.</p>
          </div>
          <Button variant="ghost" onClick={async () => setIsAddMemberOpen(false)}>Back to List</Button>
        </div>
        <div style={{ background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
          <AddTeamMemberForm 
            onCancel={() => setIsAddMemberOpen(false)} 
            onSuccess={(newUser) => {
              setIsAddMemberOpen(false);
              setActiveTab('approvals');
              if (newUser) {
                setInjectedUsers(prev => {
                  if (prev.some(u => u.id === newUser.id)) return prev;
                  return [newUser, ...prev];
                });
              }
            }} 
            roleOptions={roleOptions}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 fade-in">
      <div className={layoutStyles.configSection}>
        <div className={layoutStyles.sectionHeader}>
          <div>
            <h2 className={layoutStyles.sectionTitle}>Team Members</h2>
            <p className={layoutStyles.sectionDesc}>Manage who has access to this workspace.</p>
          </div>
          
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <AIInsightsPanel />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>

              <div style={{ display: 'flex', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-full)', padding: '2px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)' }}>
                <button 
                  style={{ padding: '6px 14px', border: 'none', background: viewMode === 'table' ? 'var(--color-bg)' : 'transparent', color: viewMode === 'table' ? 'var(--color-text)' : 'var(--color-text-muted)', borderRadius: 'var(--radius-full)', fontWeight: viewMode === 'table' ? '600' : '500', cursor: 'pointer', transition: 'all 0.2s', boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                  onClick={async () => setViewMode('table')}
                >Table</button>
                <button 
                  style={{ padding: '6px 14px', border: 'none', background: viewMode === 'grid' ? 'var(--color-bg)' : 'transparent', color: viewMode === 'grid' ? 'var(--color-text)' : 'var(--color-text-muted)', borderRadius: 'var(--radius-full)', fontWeight: viewMode === 'grid' ? '600' : '500', cursor: 'pointer', transition: 'all 0.2s', boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
                  onClick={async () => setViewMode('grid')}
                >Grid</button>
              </div>
              <Button variant="secondary" onClick={async () => setShowImportExport(true)}>Import / Export</Button>
              <PermissionButton permission="users:invite_user" variant="secondary" onClick={async () => setBulkModalType('add')}>Bulk Add</PermissionButton>

              <PermissionButton permission="users:invite_user" variant="primary" onClick={async () => setIsAddMemberOpen(true)}>+ Add Team Member</PermissionButton>
            </div>

        </div>

        {selectedIds.size > 0 && (
          <div style={{
            position: 'fixed', top: '100px', right: '32px',
            background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(16px)',
            padding: '20px', borderRadius: '16px', minWidth: '240px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0,0,0,0.05)',
            display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 100,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', marginBottom: '8px', borderBottom: '1px solid var(--color-border, #f3f4f6)' }}>
              <div style={{ 
                background: 'var(--color-primary, #3b82f6)', color: 'white', 
                width: '32px', height: '32px', borderRadius: '50%', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: '700', fontSize: '14px',
                boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)'
              }}>
                {selectedIds.size}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text, #111827)', fontSize: '15px' }}>Users Selected</span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted, #6b7280)' }}>Bulk Actions</span>
              </div>
              <button 
                onClick={() => setSelectedIds(new Set())}
                style={{ 
                  background: 'var(--color-surface-hover, #f3f4f6)', border: 'none', cursor: 'pointer', 
                  color: 'var(--color-text-muted, #6b7280)', width: '28px', height: '28px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%', fontSize: '16px', fontWeight: 'bold',
                  transition: 'background 0.2s', padding: 0
                }}
                title="Clear Selection"
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
              <PermissionButton permission="users:assign_roles" variant="ghost" onClick={async () => setBulkModalType('role')} style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 12px', borderRadius: '8px', fontWeight: 500, color: 'var(--color-text-secondary)', display: 'flex', gap: '10px' }}>
                <i className="ri-shield-user-line" style={{ fontSize: '18px', color: 'var(--color-primary)' }}></i> Change Role
              </PermissionButton>
              <PermissionButton permission="users:change_department" variant="ghost" onClick={async () => setBulkModalType('department')} style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 12px', borderRadius: '8px', fontWeight: 500, color: 'var(--color-text-secondary)', display: 'flex', gap: '10px' }}>
                <i className="ri-building-line" style={{ fontSize: '18px', color: 'var(--color-secondary)' }}></i> Change Dept
              </PermissionButton>
              <PermissionButton permission="users:change_department" variant="ghost" onClick={async () => setBulkModalType('manager')} style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 12px', borderRadius: '8px', fontWeight: 500, color: 'var(--color-text-secondary)', display: 'flex', gap: '10px' }}>
                <i className="ri-user-star-line" style={{ fontSize: '18px', color: '#10b981' }}></i> Change Manager
              </PermissionButton>
              <PermissionButton permission="users:activate_user||users:deactivate_user" variant="ghost" onClick={async () => setBulkModalType('status')} style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 12px', borderRadius: '8px', fontWeight: 500, color: 'var(--color-text-secondary)', display: 'flex', gap: '10px' }}>
                <i className="ri-toggle-line" style={{ fontSize: '18px', color: '#8b5cf6' }}></i> Change Status
              </PermissionButton>
              <PermissionButton permission="users:reset_password" variant="ghost" onClick={handleBulkPasswordReset} style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 12px', borderRadius: '8px', fontWeight: 500, color: 'var(--color-text-secondary)', display: 'flex', gap: '10px' }}>
                <i className="ri-lock-password-line" style={{ fontSize: '18px', color: '#f59e0b' }}></i> Reset Password
              </PermissionButton>
              <Button variant="ghost" onClick={handleBulkExport} style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 12px', borderRadius: '8px', fontWeight: 500, color: 'var(--color-text-secondary)', display: 'flex', gap: '10px' }}>
                <i className="ri-file-download-line" style={{ fontSize: '18px', color: '#0ea5e9' }}></i> Export CSV
              </Button>
              
              <div style={{ height: '1px', width: '100%', background: 'var(--color-border, #f3f4f6)', margin: '8px 0' }}></div>
              
              <PermissionButton permission="users:delete_user" variant="ghost" onClick={handleBulkDelete} style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 12px', borderRadius: '8px', fontWeight: 600, color: 'var(--color-danger, #ef4444)', display: 'flex', gap: '10px' }}>
                <i className="ri-delete-bin-line" style={{ fontSize: '18px' }}></i> Delete Users
              </PermissionButton>
            </div>
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <SearchFilterBar 
            moduleName="users"
            departments={departments}
            roles={roles}
            branches={branches}
            managers={allUsers.filter(u => u.status !== 'pending_approval' && u.status !== 'changes_requested' && u.status !== 'rejected')}
            onFilterChange={(newFilters) => {
              setFilters(newFilters);
              fetchUsers(newFilters);
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', padding: '4px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', marginBottom: '16px', width: 'fit-content' }}>
          <button 
            style={{ padding: '8px 16px', border: 'none', background: activeTab === 'directory' ? 'var(--color-bg)' : 'transparent', color: activeTab === 'directory' ? 'var(--color-primary)' : 'var(--color-text-secondary)', borderRadius: 'var(--radius-md)', fontWeight: activeTab === 'directory' ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeTab === 'directory' ? 'var(--shadow-sm)' : 'none' }} 
            onClick={async () => { setActiveTab('directory'); setSelectedIds(new Set()); }}
          >
            Active Directory
          </button>
          <button 
            style={{ padding: '8px 16px', border: 'none', background: activeTab === 'approvals' ? 'var(--color-bg)' : 'transparent', color: activeTab === 'approvals' ? 'var(--color-primary)' : 'var(--color-text-secondary)', borderRadius: 'var(--radius-md)', fontWeight: activeTab === 'approvals' ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeTab === 'approvals' ? 'var(--shadow-sm)' : 'none' }} 
            onClick={async () => { setActiveTab('approvals'); setSelectedIds(new Set()); }}
          >
            Pending Approvals <Badge variant="neutral">{allUsers.filter(u => u.status === 'pending_approval' || u.status === 'changes_requested').length}</Badge>
          </button>
          <button 
            style={{ padding: '8px 16px', border: 'none', background: activeTab === 'emails' ? 'var(--color-bg)' : 'transparent', color: activeTab === 'emails' ? 'var(--color-primary)' : 'var(--color-text-secondary)', borderRadius: 'var(--radius-md)', fontWeight: activeTab === 'emails' ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeTab === 'emails' ? 'var(--shadow-sm)' : 'none' }} 
            onClick={async () => { setActiveTab('emails'); setSelectedIds(new Set()); }}
          >
            Email Logs
          </button>
          <button 
            style={{ padding: '8px 16px', border: 'none', background: activeTab === 'offboarding' ? 'var(--color-bg)' : 'transparent', color: activeTab === 'offboarding' ? 'var(--color-primary)' : 'var(--color-text-secondary)', borderRadius: 'var(--radius-md)', fontWeight: activeTab === 'offboarding' ? 600 : 500, cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeTab === 'offboarding' ? 'var(--shadow-sm)' : 'none' }} 
            onClick={async () => { setActiveTab('offboarding'); setSelectedIds(new Set()); }}
          >
            Offboarding
          </button>
        </div>

        
        {activeTab === 'directory' || activeTab === 'approvals' ? (
          viewMode === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {(activeTab === 'directory' ? allUsers.filter(u => u.status !== 'pending_approval' && u.status !== 'changes_requested') : allUsers.filter(u => u.status === 'pending_approval' || u.status === 'changes_requested')).map(u => (
                <UserGridCard 
                  key={u.id} 
                  user={u} 
                  selected={selectedIds.has(u.id)}
                  onToggleSelect={(id, checked) => {
                    const next = new Set(selectedIds)
                    if(checked) next.add(id)
                    else next.delete(id)
                    setSelectedIds(next)
                  }}
                  onRowClick={() => navigate(`/team/members/${u.id}`)}
                  onContextMenu={(e, row) => {
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      user: row
                    })
                  }}
                />
              ))}
            </div>
          ) : (
          <div style={{ width: '100%' }}>
            <DataTable 
              columns={columns} 
              data={activeTab === 'directory' ? allUsers.filter(u => u.status !== 'pending_approval' && u.status !== 'changes_requested') : allUsers.filter(u => u.status === 'pending_approval' || u.status === 'changes_requested')} 
              selectable={activeTab === 'directory'}
              selectedIds={selectedIds}
              onSelectChange={setSelectedIds}
              visibleColumns={visibleColumns}
              onContextMenu={(e, row) => {
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  user: row
                })
              }}
            />
          </div>
          )

        ) : activeTab === 'emails' ? (
          <EmailLogsTab />
        ) : activeTab === 'offboarding' ? (
          <OffboardingDashboard />
        ) : null}



        {/* Role Change Modal */}
        <Modal
          isOpen={!!roleChangeTarget}
          onClose={() => setRoleChangeTarget(null)}
          title="Change Role"
          footer={
            <>
              <Button variant="ghost" onClick={async () => setRoleChangeTarget(null)}>Cancel</Button>
              <Button variant="primary" onClick={confirmRoleChange}>Confirm</Button>
            </>
          }
        >
          <p>Change {roleChangeTarget?.user.name}'s role to {roleOptions.find(r => r.value === roleChangeTarget?.newRole)?.label}?</p>
        </Modal>

        <EmployeeApprovalModal 
          isOpen={!!approvalTarget}
          onClose={() => setApprovalTarget(null)}
          user={approvalTarget}
          onStatusChange={(userId, newStatus) => {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u))
            setInjectedUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u))
          }}
        />

        <StatusManagerModal 
          isOpen={!!statusChangeTarget}
          onClose={() => setStatusChangeTarget(null)}
          user={statusChangeTarget}
          onStatusChange={(userId, newStatus) => {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u))
            setInjectedUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u))
          }}
        />

        {offboardingTarget && (
          <InitiateOffboardingModal 
            user={offboardingTarget} 
            onClose={() => setOffboardingTarget(null)} 
            onSuccess={() => {
              setOffboardingTarget(null);
              setActiveTab('offboarding');
            }} 
          />
        )}

        <EffectivePermissionViewer 
          isOpen={!!effectivePermUserTarget} 
          onClose={() => setEffectivePermUserTarget(null)} 
          user={effectivePermUserTarget} 
        />

        <PermissionAssignmentModal
          isOpen={!!assignPermUserTarget}
          onClose={() => {
            setAssignPermUserTarget(null)
            fetchUsers()
          }}
          user={assignPermUserTarget}
        />

        <BulkUserModals 
          isOpen={!!bulkModalType}
          onClose={() => setBulkModalType(null)}
          type={bulkModalType}
          selectedUsers={users.filter(u => selectedIds.has(u.id))}
          roles={roles}
          departments={departments}
          allUsers={users}
          onSuccess={() => {
            setBulkModalType(null)
            setSelectedIds(new Set())
            fetchUsers()
          }}
        />

        <AdvancedImportExportModal
          isOpen={showImportExport}
          onClose={() => setShowImportExport(false)}
          onSuccess={fetchUsers}
          dataToExport={users.filter(u => selectedIds.has(u.id)).map(u => ({
            Name: u.name,
            Email: u.email,
            Role: u.role_name || '-',
            Department: u.department_name || '-',
            Manager: u.manager_name || '-',
            Status: u.status
          }))}
        />


        {contextMenu && (
          <ContextMenu 
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            options={[
              { label: 'View Profile', onClick: () => navigate(`/team/members/${contextMenu.user.id}`) },
              { label: 'Change Status', onClick: () => setStatusChangeTarget(contextMenu.user) },
              
              { label: 'Deactivate', danger: true, onClick: () => setOffboardingTarget(contextMenu.user) },
              { divider: true },
              { label: '🔥 Login as User (Impersonate)', onClick: async () => {
                if(await confirm('WARNING: All actions performed will be logged against your audit trail. Proceed?')) {
                  await api.post(`/superadmin/impersonate/${contextMenu.user.id}`);
                  toast.success('Impersonation mode activated');
                }
              } },
              { label: '🔥 Force Logout All Sessions', onClick: async () => {
                if(await confirm('Force terminate all active sessions for this user?')) {
                  await api.post(`/superadmin/force-logout/${contextMenu.user.id}`);
                  toast.success('Sessions terminated');
                }
              } },
              { label: '🔥 Emergency Account Lock', danger: true, onClick: async () => {
                if(await confirm('CRITICAL: Lock this account immediately?')) {
                  await api.post(`/superadmin/emergency-lock/${contextMenu.user.id}`);
                  toast.success('Account locked');
                  fetchUsers();
                }
              } }

            ]}
          />
        )}

        {renderMockConfigModal()}
      </div>
    </div>
  )
}
