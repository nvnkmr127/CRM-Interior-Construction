import { useState, useEffect } from 'react'
import layoutStyles from './ConfigLayout.module.css'
import { Button, Badge, Modal, DataTable, Avatar, Input, Select } from '../../components/ui'
import { useToast } from '../../store/toastContext'
import api from '../../api/axios'

const ROLE_OPTIONS = [
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'pm', label: 'Project Manager' },
  { value: 'designer', label: 'Designer' },
  { value: 'sales', label: 'Sales' }
]

export default function UsersManager() {
  const [users, setUsers] = useState([])
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteData, setInviteData] = useState({ name: '', email: '', role: 'designer' })
  const [roleChangeTarget, setRoleChangeTarget] = useState(null)
  const [statusChangeTarget, setStatusChangeTarget] = useState(null)
  const toast = useToast()

  useEffect(() => {
    api.get('/users')
      .then(res => { const r = res.data?.data || res.data; setUsers(Array.isArray(r) ? r : []); })
      .catch(() => setUsers([]))
  }, [])

  const handleInvite = async () => {
    if (!inviteData.name || !inviteData.email) return toast.error('Name and email are required')
    try {
      const res = await api.post('/users/invite', inviteData)
      const newUser = res.data?.data || { ...inviteData, id: Date.now().toString(), status: 'invited', lastActive: null }
      setUsers(prev => [...prev, newUser])
      setIsInviteOpen(false)
      setInviteData({ name: '', email: '', role: 'designer' })
      toast.success(`Invitation sent to ${inviteData.email}`)
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to send invitation')
    }
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

  const confirmStatusChange = async () => {
    if (!statusChangeTarget) return
    const newStatus = statusChangeTarget.user.status === 'active' ? 'inactive' : 'active'
    setUsers(prev => prev.map(u => u.id === statusChangeTarget.user.id ? { ...u, status: newStatus } : u))
    try {
      await api.patch(`/users/${statusChangeTarget.user.id}`, { status: newStatus })
      toast.success(`${statusChangeTarget.user.name} is now ${newStatus}`)
    } catch {
      setUsers(prev => prev.map(u => u.id === statusChangeTarget.user.id ? { ...u, status: statusChangeTarget.user.status } : u))
      toast.error('Failed to update status')
    }
    setStatusChangeTarget(null)
  }

  const columns = [
    {
      key: 'user', label: 'User', 
      render: (u) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Avatar name={u.name} size="sm" />
          <div>
            <div style={{ fontWeight: 500, color: 'var(--color-text)' }}>{u.name}</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{u.email}</div>
          </div>
        </div>
      )
    },
    {
      key: 'role', label: 'Role',
      render: (u) => {
        const roleColors = { superadmin: 'accent', pm: 'info', designer: 'neutral', sales: 'success' }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Badge variant={roleColors[u.role]}>{ROLE_OPTIONS.find(r => r.value === u.role)?.label}</Badge>
          </div>
        )
      }
    },
    {
      key: 'status', label: 'Status',
      render: (u) => {
        const statusColors = { active: 'success', inactive: 'neutral', invited: 'warning' }
        return <Badge variant={statusColors[u.status]}>{u.status}</Badge>
      }
    },
    {
      key: 'lastActive', label: 'Last Active',
      render: (u) => u.lastActive ? new Date(u.lastActive).toLocaleString() : <span style={{color:'var(--color-text-muted)'}}>Never</span>
    },
    {
      key: 'actions', label: 'Actions', align: 'right',
      render: (u) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
          <Select 
            value={u.role} 
            options={ROLE_OPTIONS} 
            onChange={(val) => setRoleChangeTarget({ user: u, newRole: val })}
          />
          {u.status === 'active' ? (
            <Button variant="ghost" size="sm" style={{color:'var(--color-danger)'}} onClick={() => setStatusChangeTarget({ user: u })}>
              Deactivate
            </Button>
          ) : u.status === 'inactive' ? (
            <Button variant="ghost" size="sm" style={{color:'var(--color-success)'}} onClick={() => setStatusChangeTarget({ user: u })}>
              Activate
            </Button>
          ) : null}
        </div>
      )
    }
  ]

  return (
    <div className={layoutStyles.configSection}>
      <div className={layoutStyles.sectionHeader}>
        <div>
          <h2 className={layoutStyles.sectionTitle}>Team Members</h2>
          <p className={layoutStyles.sectionDesc}>Manage who has access to this workspace.</p>
        </div>
        <Button variant="primary" onClick={() => setIsInviteOpen(true)}>+ Invite Member</Button>
      </div>

      <DataTable columns={columns} data={users} />

      {/* Invite Modal */}
      <Modal 
        isOpen={isInviteOpen} 
        onClose={() => setIsInviteOpen(false)} 
        title="Invite Member"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsInviteOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleInvite}>Send Invite</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input 
            label="Full Name" 
            value={inviteData.name} 
            onChange={e => setInviteData({...inviteData, name: e.target.value})} 
            required 
          />
          <Input 
            label="Email Address" 
            type="email" 
            value={inviteData.email} 
            onChange={e => setInviteData({...inviteData, email: e.target.value})} 
            required 
          />
          <Select 
            label="Role" 
            options={ROLE_OPTIONS} 
            value={inviteData.role} 
            onChange={val => setInviteData({...inviteData, role: val})} 
          />
        </div>
      </Modal>

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
        <p>Change {roleChangeTarget?.user.name}'s role to {ROLE_OPTIONS.find(r => r.value === roleChangeTarget?.newRole)?.label}?</p>
      </Modal>

      {/* Status Change Modal */}
      <Modal
        isOpen={!!statusChangeTarget}
        onClose={() => setStatusChangeTarget(null)}
        title={statusChangeTarget?.user.status === 'active' ? 'Deactivate User' : 'Activate User'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setStatusChangeTarget(null)}>Cancel</Button>
            <Button 
              variant="primary" 
              style={statusChangeTarget?.user.status === 'active' ? {background:'var(--color-danger)', borderColor:'var(--color-danger)'} : {}}
              onClick={confirmStatusChange}
            >
              Confirm
            </Button>
          </>
        }
      >
        <p>Are you sure you want to {statusChangeTarget?.user.status === 'active' ? 'deactivate' : 'activate'} {statusChangeTarget?.user.name}?</p>
      </Modal>
    </div>
  )
}
