import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import layoutStyles from './ConfigLayout.module.css'
import { Button, Badge, Modal, DataTable, Avatar, Input, Select, EmptyState } from '../../components/ui'
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

const DEFAULT_ROLE_OPTIONS = [
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'pm', label: 'Project Manager' },
  { value: 'designer', label: 'Designer' },
  { value: 'sales', label: 'Sales' }
]

export default function UsersManager() {
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
  const toast = useToast()

  const [roles, setRoles] = useState([])
  const [departments, setDepartments] = useState([])
  const [branches, setBranches] = useState([])
  const [filters, setFilters] = useState({})
  const [injectedUsers, setInjectedUsers] = useState([])
  
  const allUsers = [...injectedUsers, ...users].filter((v, i, a) => a.findIndex(v2 => v2.id === v.id) === i)

  const roleOptions = roles.length > 0 
    ? roles.map(r => ({ value: r.id, label: r.name })) 
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
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} users?`)) return;
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
      key: 'user', label: 'User', 
      render: (u) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => setSelectedUserId(u.id)}>
          <Avatar name={u.name || '?'} size="sm" />
          <div>
            <div style={{ fontWeight: 500, color: 'var(--color-primary)', textDecoration: 'underline' }}>{u.name || 'Unknown User'}</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{u.email || '-'}</div>
          </div>
        </div>
      )
    },
    {
      key: 'role', label: 'Role',
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
      key: 'status', label: 'Status',
      render: (u) => {
        const statusVal = u.status || 'inactive'
        return <Badge variant={STATUS_COLORS[statusVal] || 'neutral'}>{statusVal.toUpperCase().replace('_', ' ')}</Badge>
      }
    },
    {
      key: 'lastActive', label: 'Last Active',
      render: (u) => u.lastActive ? new Date(u.lastActive).toLocaleString() : <span style={{color:'var(--color-text-muted)'}}>Never</span>
    },
    {
      key: 'actions', label: 'Actions', align: 'right',
      render: (u) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'flex-end' }}>
          {u.status === 'pending_approval' || u.status === 'changes_requested' ? (
            <Button variant="secondary" onClick={() => setApprovalTarget(u)}>Review</Button>
          ) : (
            <>
              <div style={{ minWidth: '160px', textAlign: 'left' }}>
                <Select 
                  value={u.role_id || u.role} 
                  options={roleOptions} 
                  onChange={(val) => setRoleChangeTarget({ user: u, newRole: val })}
                />
              </div>

              {u.status === 'inactive' || u.status === 'archived' || u.status === 'resigned' || u.status === 'terminated' ? (
                <Button variant="primary" onClick={() => setStatusChangeTarget(u)}>
                  Reactivate
                </Button>
              ) : (
                <Button variant="danger" onClick={() => setOffboardingTarget(u)}>
                  Deactivate
                </Button>
              )}
            </>
          )}
        </div>
      )
    }
  ]

    if (selectedUserId) {
    return <EmployeeProfilePage userId={selectedUserId} onBack={() => setSelectedUserId(null)} />;
  }

  if (isAddMemberOpen) {
    return (
      <div className={layoutStyles.configSection} style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflowY: 'auto' }}>
        <div className={layoutStyles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 className={layoutStyles.sectionTitle}>Add Team Member</h2>
            <p className={layoutStyles.sectionDesc}>Create a new employee profile and set permissions.</p>
          </div>
          <Button variant="ghost" onClick={() => setIsAddMemberOpen(false)}>Back to List</Button>
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
    <div className="mx-auto max-w-7xl p-4 sm:p-8 space-y-8">
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

              <div style={{ display: 'flex', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
                <button 
                  style={{ padding: '4px 8px', border: 'none', background: viewMode === 'table' ? 'var(--color-surface-hover)' : 'transparent', cursor: 'pointer' }}
                  onClick={() => setViewMode('table')}
                >Table</button>
                <button 
                  style={{ padding: '4px 8px', border: 'none', background: viewMode === 'grid' ? 'var(--color-surface-hover)' : 'transparent', cursor: 'pointer' }}
                  onClick={() => setViewMode('grid')}
                >Grid</button>
              </div>
              <Button variant="secondary" onClick={() => setShowImportExport(true)}>Import / Export</Button>
              <Button variant="secondary" onClick={() => setBulkModalType('add')}>Bulk Add</Button>
              <Button variant="primary" onClick={() => setIsAddMemberOpen(true)}>+ Add Team Member</Button>
            </div>

        </div>

        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--color-surface-hover)', borderRadius: '8px', border: '1px solid var(--color-border)', marginBottom: '16px' }}>
            <div style={{ fontWeight: 500 }}>{selectedIds.size} users selected</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button size="small" variant="ghost" onClick={() => setBulkModalType('role')}>Change Role</Button>
              <Button size="small" variant="ghost" onClick={() => setBulkModalType('department')}>Change Dept</Button>
              <Button size="small" variant="ghost" onClick={() => setBulkModalType('manager')}>Change Manager</Button>
              <Button size="small" variant="ghost" onClick={() => setBulkModalType('status')}>Change Status</Button>
              <Button size="small" variant="ghost" onClick={handleBulkPasswordReset}>Reset Password</Button>
              <Button size="small" variant="ghost" onClick={handleBulkExport}>Export CSV</Button>
              <Button size="small" variant="danger" onClick={handleBulkDelete}>Delete</Button>
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

        <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--color-border)', marginBottom: '16px' }}>
          <div 
            style={{ paddingBottom: '8px', cursor: 'pointer', fontWeight: activeTab === 'directory' ? 600 : 400, color: activeTab === 'directory' ? 'var(--color-primary)' : 'var(--color-text-secondary)', borderBottom: activeTab === 'directory' ? '2px solid var(--color-primary)' : '2px solid transparent' }} 
            onClick={() => { setActiveTab('directory'); setSelectedIds(new Set()); }}
          >
            Active Directory
          </div>
          <div 
            style={{ paddingBottom: '8px', cursor: 'pointer', fontWeight: activeTab === 'approvals' ? 600 : 400, color: activeTab === 'approvals' ? 'var(--color-primary)' : 'var(--color-text-secondary)', borderBottom: activeTab === 'approvals' ? '2px solid var(--color-primary)' : '2px solid transparent' }} 
            onClick={() => { setActiveTab('approvals'); setSelectedIds(new Set()); }}
          >
            Pending Approvals ({allUsers.filter(u => u.status === 'pending_approval' || u.status === 'changes_requested').length})
          </div>
          <div 
            style={{ paddingBottom: '8px', cursor: 'pointer', fontWeight: activeTab === 'emails' ? 600 : 400, color: activeTab === 'emails' ? 'var(--color-primary)' : 'var(--color-text-secondary)', borderBottom: activeTab === 'emails' ? '2px solid var(--color-primary)' : '2px solid transparent' }} 
            onClick={() => { setActiveTab('emails'); setSelectedIds(new Set()); }}
          >
            Email Logs
          </div>
          <div 
            style={{ paddingBottom: '8px', cursor: 'pointer', fontWeight: activeTab === 'offboarding' ? 600 : 400, color: activeTab === 'offboarding' ? 'var(--color-primary)' : 'var(--color-text-secondary)', borderBottom: activeTab === 'offboarding' ? '2px solid var(--color-primary)' : '2px solid transparent' }} 
            onClick={() => { setActiveTab('offboarding'); setSelectedIds(new Set()); }}
          >
            Offboarding
          </div>
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
                  onRowClick={() => navigate(`/config/team-members/${u.id}`)}
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
              <Button variant="ghost" onClick={() => setRoleChangeTarget(null)}>Cancel</Button>
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
              { label: 'View Profile', onClick: () => navigate(`/config/team-members/${contextMenu.user.id}`) },
              { label: 'Change Status', onClick: () => setStatusChangeTarget(contextMenu.user) },
              
              { label: 'Deactivate', danger: true, onClick: () => setOffboardingTarget(contextMenu.user) },
              { divider: true },
              { label: '🔥 Login as User (Impersonate)', onClick: async () => {
                if(window.confirm('WARNING: All actions performed will be logged against your audit trail. Proceed?')) {
                  await api.post(`/superadmin/impersonate/${contextMenu.user.id}`);
                  toast.success('Impersonation mode activated');
                }
              } },
              { label: '🔥 Force Logout All Sessions', onClick: async () => {
                if(window.confirm('Force terminate all active sessions for this user?')) {
                  await api.post(`/superadmin/force-logout/${contextMenu.user.id}`);
                  toast.success('Sessions terminated');
                }
              } },
              { label: '🔥 Emergency Account Lock', danger: true, onClick: async () => {
                if(window.confirm('CRITICAL: Lock this account immediately?')) {
                  await api.post(`/superadmin/emergency-lock/${contextMenu.user.id}`);
                  toast.success('Account locked');
                  fetchUsers();
                }
              } }

            ]}
          />
        )}
      </div>
    </div>
  )
}
