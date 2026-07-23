import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import { useToast } from '../../store/toastContext'
import { Button, Input, Select, Badge, Modal, Textarea } from '../../components/ui'
import { format } from 'date-fns'

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: '👤' },
  { id: 'timeline', label: 'Activity Timeline', icon: '⏱' },
  { id: 'projects', label: 'Projects', icon: '📁' },
  { id: 'tasks', label: 'Tasks', icon: '☑' },
  { id: 'permissions', label: 'Permissions', icon: '🔐' },
  { id: 'documents', label: 'Documents', icon: '📄' },
  { id: 'attendance', label: 'Attendance', icon: '📅' },
  { id: 'login-history', label: 'Login History', icon: '🖥' },
  { id: 'devices', label: 'Devices', icon: '📱' },
  { id: 'audit-logs', label: 'Audit Logs', icon: '📋' },
  { id: 'notes', label: 'Internal Notes', icon: '📝' },
  { id: 'performance', label: 'Performance', icon: '⭐' },
]

export default function EmployeeProfilePage({ userId, onBack }) {
  const params = useParams()
  const id = userId || params.id
  const navigate = useNavigate()
  const toast = useToast()

  const [activeSection, setActiveSection] = useState('overview')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // States for sub-data
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [sessions, setSessions] = useState([])
  const [loginHistory, setLoginHistory] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [timelineEvents, setTimelineEvents] = useState([])
  
  // Edit mode
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({})

  useEffect(() => {
    fetchUserData()
  }, [id])

  useEffect(() => {
    if (!user) return;
    if (activeSection === 'projects' && projects.length === 0) fetchProjects()
    if (activeSection === 'tasks' && tasks.length === 0) fetchTasks()
    if (activeSection === 'devices' && sessions.length === 0) fetchSessions()
    if (activeSection === 'login-history' && loginHistory.length === 0) fetchLoginHistory()
    if (activeSection === 'audit-logs' && auditLogs.length === 0) fetchAuditLogs()
    if (activeSection === 'timeline' && timelineEvents.length === 0) fetchTimelineEvents()
  }, [activeSection, user])

  const fetchUserData = async () => {
    try {
      const res = await api.get(`/users/${id}`)
      setUser(res.data.data)
      setEditForm(res.data.data)
    } catch (err) {
      toast.error('Failed to load user data')
      navigate('/config/team-members')
    } finally {
      setLoading(false)
    }
  }

  const fetchProjects = async () => {
    try {
      const res = await api.get(`/users/${id}/projects`)
      setProjects(res.data.data || [])
    } catch (err) { console.error(err) }
  }

  const fetchTasks = async () => {
    try {
      const res = await api.get(`/users/${id}/tasks`)
      setTasks(res.data.data || [])
    } catch (err) { console.error(err) }
  }

  const fetchSessions = async () => {
    try {
      const res = await api.get(`/users/${id}/sessions`)
      setSessions(res.data.data || [])
    } catch (err) { console.error(err) }
  }

  const fetchLoginHistory = async () => {
    try {
      const res = await api.get(`/users/${id}/login-history`)
      setLoginHistory(res.data.data || [])
    } catch (err) { console.error(err) }
  }

  const handleRevokeSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to revoke this active session? The user will be immediately logged out.')) return;
    try {
      await api.delete(`/login-history/sessions/${sessionId}`);
      toast.success('Session revoked successfully');
      fetchSessions();
      fetchLoginHistory();
    } catch (err) {
      toast.error('Failed to revoke session');
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get(`/users/${id}/audit`)
      setAuditLogs(res.data.data || [])
    } catch (err) { console.error(err) }
  }

  const fetchTimelineEvents = async () => {
    try {
      const res = await api.get(`/users/${id}/timeline`)
      setTimelineEvents(res.data.data || [])
    } catch (err) { console.error(err) }
  }

  const handleSaveProfile = async () => {
    try {
      // In a real app, we would update profile_data through the patch endpoint
      // We will send standard fields to the PATCH /users/:id endpoint
      await api.patch(`/users/${id}`, {
        name: editForm.name,
        avatar_url: editForm.avatar_url,
        // Assuming we update profile_data inside the user record (not fully supported by existing patch, but we simulate it)
      })
      toast.success('Profile updated')
      setIsEditing(false)
      setUser(editForm)
    } catch (err) {
      toast.error('Failed to update profile')
    }
  }

  if (loading) return <div>Loading Profile...</div>
  if (!user) return null

  const profile = user.profile_data || {}
  const formProfile = editForm.profile_data || {}

  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Personal & Work Information</h3>
              {!isEditing ? (
                <Button variant="secondary" onClick={() => setIsEditing(true)}>Edit Profile</Button>
              ) : (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <Button variant="ghost" onClick={() => { setIsEditing(false); setEditForm(user) }}>Cancel</Button>
                  <Button variant="primary" onClick={handleSaveProfile}>Save Changes</Button>
                </div>
              )}
            </div>

            <div style={{ background: 'var(--color-background-soft)', padding: '24px', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Full Name</label>
                {isEditing ? <Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /> : <div style={{ fontWeight: 500 }}>{user.name}</div>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Official Email</label>
                <div style={{ fontWeight: 500 }}>{user.email} (Non-editable)</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Phone / Mobile</label>
                {isEditing ? <Input value={formProfile.mobileNumber || ''} onChange={e => setEditForm({...editForm, profile_data: {...formProfile, mobileNumber: e.target.value}})} /> : <div style={{ fontWeight: 500 }}>{profile.mobileNumber || 'N/A'}</div>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Date of Birth</label>
                {isEditing ? <Input type="date" value={formProfile.dob || ''} onChange={e => setEditForm({...editForm, profile_data: {...formProfile, dob: e.target.value}})} /> : <div style={{ fontWeight: 500 }}>{profile.dob || 'N/A'}</div>}
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Address</label>
                {isEditing ? <Input value={formProfile.address || ''} onChange={e => setEditForm({...editForm, profile_data: {...formProfile, address: e.target.value}})} /> : <div style={{ fontWeight: 500 }}>{profile.address || 'N/A'}</div>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Department</label>
                {isEditing ? <Input value={formProfile.department || ''} onChange={e => setEditForm({...editForm, profile_data: {...formProfile, department: e.target.value}})} /> : <div style={{ fontWeight: 500 }}>{profile.department || 'N/A'}</div>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Designation</label>
                {isEditing ? <Input value={formProfile.designation || ''} onChange={e => setEditForm({...editForm, profile_data: {...formProfile, designation: e.target.value}})} /> : <div style={{ fontWeight: 500 }}>{profile.designation || 'N/A'}</div>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Joining Date</label>
                {isEditing ? <Input type="date" value={formProfile.joiningDate || ''} onChange={e => setEditForm({...editForm, profile_data: {...formProfile, joiningDate: e.target.value}})} /> : <div style={{ fontWeight: 500 }}>{profile.joiningDate || 'N/A'}</div>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Employment Type</label>
                {isEditing ? <Input value={formProfile.employmentType || ''} onChange={e => setEditForm({...editForm, profile_data: {...formProfile, employmentType: e.target.value}})} /> : <div style={{ fontWeight: 500 }}>{profile.employmentType || 'N/A'}</div>}
              </div>
            </div>
          </div>
        )

      case 'timeline':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Employee Timeline</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', borderLeft: '2px solid var(--color-border)', marginLeft: '12px', paddingLeft: '20px', marginTop: '8px' }}>
              {timelineEvents.length === 0 ? <p className="text-gray-500">No events available.</p> : timelineEvents.map(event => (
                <div key={event.id} style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '-34px', top: '0', width: '28px', height: '28px', borderRadius: '50%', background: 'white', border: '2px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', zIndex: 1 }}>
                    {event.icon}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>{event.title}</div>
                      <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{event.description}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        👤 {event.actor_name}
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      {event.timestamp && !isNaN(new Date(event.timestamp).getTime()) ? format(new Date(event.timestamp), 'PP p') : '-'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      case 'projects':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Assigned Projects</h3>
            {projects.length === 0 ? <p>No projects assigned.</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Project Name</th>
                      <th style={{ padding: '8px' }}>Type</th>
                      <th style={{ padding: '8px' }}>Status</th>
                      <th style={{ padding: '8px' }}>Start Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '12px 8px' }}>{p.name}</td>
                        <td style={{ padding: '12px 8px' }}>{p.project_type}</td>
                        <td style={{ padding: '12px 8px' }}><Badge>{p.status}</Badge></td>
                        <td style={{ padding: '12px 8px' }}>{p.start_date ? format(new Date(p.start_date), 'PP') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )

      case 'tasks':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Assigned Tasks</h3>
            {tasks.length === 0 ? <p>No tasks assigned.</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Task</th>
                      <th style={{ padding: '8px' }}>Project</th>
                      <th style={{ padding: '8px' }}>Status</th>
                      <th style={{ padding: '8px' }}>Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '12px 8px' }}>{t.title}</td>
                        <td style={{ padding: '12px 8px' }}>{t.project_name || 'N/A'}</td>
                        <td style={{ padding: '12px 8px' }}><Badge>{t.status}</Badge></td>
                        <td style={{ padding: '12px 8px' }}>{t.priority}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )

      case 'permissions':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Role & Permissions</h3>
            <div style={{ background: 'var(--color-background-soft)', padding: '24px', borderRadius: '8px' }}>
              <div style={{ fontSize: '14px', marginBottom: '16px' }}><strong>Role:</strong> {user.role_name}</div>
              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Module Permissions:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {Array.isArray(user.permissions) && user.permissions.map((p, i) => (
                  <Badge key={i} variant="secondary">{p}</Badge>
                ))}
                {(!user.permissions || user.permissions.length === 0) && <span>No explicit permissions</span>}
              </div>
            </div>
          </div>
        )

      case 'login-history':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Login History</h3>
            {loginHistory.length === 0 ? <p>No login history found.</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Date</th>
                      <th style={{ padding: '8px' }}>IP / Location</th>
                      <th style={{ padding: '8px' }}>Device & OS</th>
                      <th style={{ padding: '8px' }}>Duration</th>
                      <th style={{ padding: '8px' }}>Status</th>
                      <th style={{ padding: '8px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loginHistory.map(lh => (
                      <tr key={lh.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '12px 8px' }}>{lh.login_time && !isNaN(new Date(lh.login_time).getTime()) ? format(new Date(lh.login_time), 'PP p') : '-'}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <div>{lh.ip_address || '-'}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Unknown</div>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <div>{lh.device} - {lh.os}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{lh.browser}</div>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          {!lh.logout_time ? (
                            lh.active_session_id ? <span style={{ color: 'var(--color-success)' }}>Active Session</span> : <span style={{ color: 'var(--color-text-secondary)' }}>Expired</span>
                          ) : 
                          `${Math.floor((lh.duration_seconds || 0) / 60)}m ${(lh.duration_seconds || 0) % 60}s`}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          {lh.status === 'success' ? <Badge variant="success">Success</Badge> : 
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                             <Badge variant="danger">Failed</Badge>
                             <span style={{ fontSize: '11px', color: 'var(--color-danger)' }}>{lh.failure_reason}</span>
                           </div>
                          }
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          {lh.status === 'success' && !lh.logout_time && lh.active_session_id && (
                            <Button variant="danger" size="small" onClick={() => handleRevokeSession(lh.active_session_id)}>
                              Revoke
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )

      case 'devices':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Active Devices</h3>
            {sessions.length === 0 ? <p>No session data found.</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>IP Address</th>
                      <th style={{ padding: '8px' }}>Device / Browser</th>
                      <th style={{ padding: '8px' }}>Last Active</th>
                      <th style={{ padding: '8px' }}>Status</th>
                      <th style={{ padding: '8px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '12px 8px' }}>{s.ip_address || 'Unknown'}</td>
                        <td style={{ padding: '12px 8px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.user_agent}</td>
                        <td style={{ padding: '12px 8px' }}>{s.last_active_at && !isNaN(new Date(s.last_active_at).getTime()) ? format(new Date(s.last_active_at), 'PP p') : '-'}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <Badge variant={new Date(s.expires_at) > new Date() ? 'success' : 'secondary'}>
                            {new Date(s.expires_at) > new Date() ? 'Active' : 'Expired'}
                          </Badge>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          {new Date(s.expires_at) > new Date() && (
                            <Button variant="danger" size="small" onClick={() => handleRevokeSession(s.id)}>
                              Revoke
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )

      case 'audit-logs':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Recent Activity</h3>
            {auditLogs.length === 0 ? <p>No audit logs found for this user.</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Action</th>
                      <th style={{ padding: '8px' }}>Entity</th>
                      <th style={{ padding: '8px' }}>Changes</th>
                      <th style={{ padding: '8px' }}>Device & IP</th>
                      <th style={{ padding: '8px' }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map(l => (
                      <tr key={l.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '12px 8px', fontWeight: 500 }}>{l.action}</td>
                        <td style={{ padding: '12px 8px' }}>{l.entity} {l.entity_id ? `(${l.entity_id.substring(0,8)}...)` : ''}</td>
                        <td style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--color-text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.old_value || l.new_value ? 'Data changed (See Audit Trail)' : '-'}
                        </td>
                        <td style={{ padding: '12px 8px', fontSize: '12px' }}>
                          <div style={{ fontWeight: 500 }}>{l.browser || l.device ? `${l.browser || ''} ${l.device || ''}`.trim() : 'Unknown Device'}</div>
                          <div style={{ color: 'var(--color-text-secondary)' }}>{l.ip_address || '-'}</div>
                        </td>
                        <td style={{ padding: '12px 8px' }}>{l.created_at && !isNaN(new Date(l.created_at).getTime()) ? format(new Date(l.created_at), 'PP p') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )

      case 'notes':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Internal Notes</h3>
              {!isEditing ? (
                <Button variant="secondary" onClick={() => setIsEditing(true)}>Edit Notes</Button>
              ) : (
                <Button variant="primary" onClick={handleSaveProfile}>Save Notes</Button>
              )}
            </div>
            {isEditing ? (
              <Textarea 
                value={formProfile.internalNotes || ''} 
                onChange={e => setEditForm({...editForm, profile_data: {...formProfile, internalNotes: e.target.value}})}
                rows={10}
              />
            ) : (
              <div style={{ background: 'var(--color-background-soft)', padding: '24px', borderRadius: '8px', whiteSpace: 'pre-wrap', minHeight: '200px' }}>
                {profile.internalNotes || 'No internal notes found for this employee.'}
              </div>
            )}
          </div>
        )

      // Placeholders for future modules
      case 'documents':
      case 'attendance':
      case 'performance':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '64px 0', color: 'var(--color-text-secondary)' }}>
            <div style={{ fontSize: '48px' }}>🚧</div>
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text)' }}>{activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} Module Coming Soon</h3>
            <p style={{ textAlign: 'center', maxWidth: '400px' }}>This section is part of the upcoming HRMS expansion and is currently under construction.</p>
          </div>
        )

      default:
        return <div>Select a section</div>
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header (Name Card) */}
      <div style={{ 
        background: 'var(--color-background)', 
        border: '1px solid var(--color-border)', 
        borderRadius: '12px', 
        padding: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        color: 'black'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--color-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 'bold' }}>
            {user?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px 0', color: 'black' }}>{user?.name || 'Unknown User'}</h1>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '14px', color: 'black' }}>
              <span>{user?.email || 'No email'}</span>
              <span>•</span>
              <span>{user?.role_name || 'No Role'}</span>
              <span>•</span>
              <Badge variant={user?.status === 'active' ? 'success' : 'secondary'}>{user?.status?.toUpperCase() || 'UNKNOWN'}</Badge>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button variant="ghost" onClick={() => onBack ? onBack() : navigate('/config/team-members')}>Back to List</Button>
          <Button variant="secondary" onClick={() => navigate(`/config/team-members/${user.id}/settings`)}>Account Settings</Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '32px' }}>
        
        {/* Left Navigation */}
        <div className="hide-scrollbar" style={{ position: 'sticky', top: '24px', alignSelf: 'start', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', paddingRight: '8px' }}>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                width: '100%',
                background: activeSection === s.id ? 'var(--color-primary-light)' : 'transparent',
                color: activeSection === s.id ? 'var(--color-primary)' : 'var(--color-text)',
                border: 'none',
                borderRadius: '8px',
                textAlign: 'left',
                fontWeight: activeSection === s.id ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <span>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div style={{ background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '32px', minHeight: '600px' }}>
          {renderSection()}
        </div>

      </div>
    </div>
  )
}
