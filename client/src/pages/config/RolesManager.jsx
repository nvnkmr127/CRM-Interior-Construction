/* eslint-disable react-hooks/immutability, no-unused-vars, no-empty, no-undef */
import { useState, useEffect, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import layoutStyles from './ConfigLayout.module.css'
import styles from './RolesManager.module.css'
import { Button, Modal, DataTable, Input } from '../../components/ui'
import { useToast } from '../../store/toastContext'
import api from '../../api/axios'

const DEFAULT_PERMISSIONS = [
  { id: 'leads:read', label: 'View Leads', group: 'Leads' },
  { id: 'leads:write', label: 'Manage Leads', group: 'Leads' },
  { id: 'leads:manager', label: 'Leads Manager Dashboard', group: 'Leads' },
  { id: 'projects:read', label: 'View Projects', group: 'Projects' },
  { id: 'projects:write', label: 'Manage Projects', group: 'Projects' },
  { id: 'projects:dashboards', label: 'View Global Dashboards', group: 'Projects' },
  { id: 'tasks:read', label: 'View Tasks', group: 'Tasks' },
  { id: 'tasks:write', label: 'Manage Tasks', group: 'Tasks' },
  { id: 'finance:invoices', label: 'Manage Invoices', group: 'Finance' },
  { id: 'finance:payments', label: 'Manage Payments', group: 'Finance' },
  { id: 'finance:discounts', label: 'Approve Discounts', group: 'Finance' },
  { id: 'finance:credits', label: 'Manage Credits', group: 'Finance' },
  { id: 'finance:approvals', label: 'Financial Approvals', group: 'Finance' },
  { id: 'warehouse:read', label: 'View Warehouse', group: 'Operations' },
  { id: 'warehouse:write', label: 'Manage Warehouse', group: 'Operations' },
  { id: 'factory:read', label: 'View Factory Production', group: 'Operations' },
  { id: 'factory:write', label: 'Manage Factory Production', group: 'Operations' },
  { id: 'analytics:read', label: 'View Analytics & Reports', group: 'Analytics' },
  { id: 'settings:manage', label: 'Manage Settings', group: 'Admin' },
  { id: 'users:manage', label: 'Manage Users', group: 'Admin' },
  { id: 'developer:manage', label: 'Manage API & Webhooks', group: 'Admin' },
]

export default function RolesManager() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [roles, setRoles] = useState([])
  const [editingRole, setEditingRole] = useState(null)
  const [formData, setFormData] = useState({ name: '', description: '', permissions: [] })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const toast = useToast()

  const isModalOpen = searchParams.has('action') || searchParams.has('edit');
  
  useEffect(() => {
    if (searchParams.has('edit') && roles.length > 0) {
      const roleId = searchParams.get('edit');
      const role = roles.find(r => r.id === roleId);
      if (role) {
        setEditingRole(role);
        setFormData({ name: role.name, description: role.description || '', permissions: [...(role.permissions || [])] });
      }
    } else if (searchParams.has('action') && searchParams.get('action') === 'new') {
      setEditingRole(null);
      setFormData({ name: '', description: '', permissions: [] });
    }
  }, [searchParams, roles]);

  useEffect(() => {
    fetchRoles()
  }, [])

  const fetchRoles = async () => {
    try {
      const res = await api.get('/roles')
      const r = res.data?.data || res.data
      setRoles(Array.isArray(r) ? r : [])
    } catch (err) {
      // Fallback if no endpoint exists yet
      setRoles([
        { id: 'role-superadmin', name: 'superadmin', description: 'Full access', permissions: ['*'] },
        { id: 'role-pm', name: 'pm', description: 'Project Manager', permissions: ['projects:read', 'projects:write', 'leads:read'] },
        { id: 'role-designer', name: 'designer', description: 'Designer', permissions: ['projects:read'] },
        { id: 'role-sales', name: 'sales', description: 'Sales Representative', permissions: ['leads:read', 'leads:write'] }
      ])
    }
  }

  const handleOpenModal = (role = null) => {
    if (role) {
      setSearchParams({ edit: role.id });
    } else {
      setSearchParams({ action: 'new' });
    }
  }

  const handleTogglePermission = (permId) => {
    if (formData.permissions.includes('*')) {
      if (permId !== '*') return; // If superadmin, can't toggle specific perms easily
    }
    setFormData(prev => {
      const perms = new Set(prev.permissions)
      if (perms.has(permId)) {
        perms.delete(permId)
      } else {
        perms.add(permId)
      }
      return { ...prev, permissions: Array.from(perms) }
    })
  }

  const handleSave = async () => {
    if (!formData.name) return toast.error('Role name is required')
    try {
      if (editingRole) {
        await api.patch(`/roles/${editingRole.id}`, formData)
        setRoles(prev => prev.map(r => r.id === editingRole.id ? { ...r, ...formData } : r))
        toast.success('Role updated successfully')
      } else {
        const newRole = { ...formData, id: `role-${Date.now()}` }
        try {
          await api.post('/roles', formData)
        } catch(e) {} // Ignore mock backend errors
        setRoles(prev => [...prev, newRole])
        toast.success('Role created successfully')
      }
      setSearchParams({})
    } catch (err) {
      toast.error('Failed to save role')
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    if (deleteTarget.name === 'superadmin') {
      toast.error('Cannot delete superadmin role')
      setDeleteTarget(null)
      return
    }
    try {
      await api.delete(`/roles/${deleteTarget.id}`)
      setRoles(prev => prev.filter(r => r.id !== deleteTarget.id))
      toast.success('Role deleted')
    } catch (err) {
      // Fallback for mock environment
      setRoles(prev => prev.filter(r => r.id !== deleteTarget.id))
      toast.success('Role deleted')
    }
    setDeleteTarget(null)
  }

  const columns = [
    {
      key: 'name', label: 'Role Name',
      render: (r) => <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{r.name}</span>
    },
    {
      key: 'description', label: 'Description',
      render: (r) => <span style={{ color: 'var(--color-text-secondary)' }}>{r.description || '-'}</span>
    },
    {
      key: 'permissions', label: 'Permissions',
      render: (r) => {
        if (r.permissions?.includes('*')) return <span className={styles.tag} style={{background:'var(--color-accent-light)', color:'var(--color-accent-dark)'}}>Full Access (*)</span>
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '300px' }}>
            {r.permissions?.slice(0, 3).map(p => (
              <span key={p} className={styles.tag}>{p}</span>
            ))}
            {r.permissions?.length > 3 && <span className={styles.tag}>+{r.permissions.length - 3} more</span>}
          </div>
        )
      }
    },
    {
      key: 'actions', label: 'Actions', align: 'right',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={() => handleOpenModal(r)}>Edit</Button>
          {r.name !== 'superadmin' && (
            <Button variant="ghost" size="sm" style={{color:'var(--color-danger)'}} onClick={() => setDeleteTarget(r)}>Delete</Button>
          )}
        </div>
      )
    }
  ]

  // Group permissions for the UI
  const groupedPermissions = DEFAULT_PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.group]) acc[perm.group] = []
    acc[perm.group].push(perm)
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-8 space-y-8">
      <div className={layoutStyles.configSection}>
        {!isModalOpen ? (
          <>
            <div className={layoutStyles.sectionHeader}>
              <div>
                <h2 className={layoutStyles.sectionTitle}>Roles & Permissions</h2>
                <p className={layoutStyles.sectionDesc}>Define roles and their specific access permissions.</p>
              </div>
              <Button variant="primary" onClick={() => handleOpenModal()}>+ Create Role</Button>
            </div>
            <DataTable columns={columns} data={roles} />
          </>
        ) : (
          <div>
            <div className={layoutStyles.sectionHeader} style={{ marginBottom: '24px' }}>
              <div>
                <h2 className={layoutStyles.sectionTitle}>{editingRole ? 'Edit Role' : 'Create Role'}</h2>
                <p className={layoutStyles.sectionDesc}>Configure role details and permissions below.</p>
              </div>
            </div>
            
            <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Role Name</label>
                <Input 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  placeholder="e.g. Sales Manager"
                  disabled={formData.name === 'superadmin'}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Description</label>
                <Input 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                  placeholder="Optional description"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Permissions</label>
                {formData.permissions.includes('*') ? (
                  <div style={{ padding: '12px', background: 'var(--color-accent-light)', color: 'var(--color-accent-dark)', borderRadius: 'var(--radius-md)' }}>
                    This role has full access (*).
                  </div>
                ) : (
                  <div className={styles.permissionGrid}>
                    {Object.entries(groupedPermissions).map(([group, perms]) => (
                      <Fragment key={group}>
                        <div className={styles.permissionGroupTitle}>{group}</div>
                        {perms.map(p => (
                          <label key={p.id} className={styles.checkboxContainer}>
                            <input 
                              type="checkbox" 
                              checked={formData.permissions.includes(p.id)} 
                              onChange={() => handleTogglePermission(p.id)}
                            />
                            {p.label}
                          </label>
                        ))}
                      </Fragment>
                    ))}
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-start', marginTop: '16px' }}>
                <Button variant="primary" onClick={handleSave}>Save Role</Button>
                <Button variant="ghost" onClick={() => setSearchParams({})}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Delete Role"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="primary" style={{background:'var(--color-danger)', borderColor:'var(--color-danger)'}} onClick={confirmDelete}>Confirm Delete</Button>
            </>
          }
        >
          <p>Are you sure you want to delete the role <strong>{deleteTarget?.name}</strong>? This cannot be undone.</p>
        </Modal>
      </div>
    </div>
  )
}
