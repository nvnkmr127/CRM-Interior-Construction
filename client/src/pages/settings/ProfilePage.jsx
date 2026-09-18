import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './ProfilePage.module.css'
import { useAuth } from '../../store/authContext'
import { useToast } from '../../store/toastContext'
import { usePageTitle } from '../../hooks/usePageTitle'
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs'
import { Avatar, Badge, Button, Input } from '../../components/ui'
import api from '../../api/axios'
import { useConfirm } from '../../store/confirmContext'
import { format } from 'date-fns'

import {
  FiUser,
  FiMail,
  FiPhone,
  FiCalendar,
  FiMapPin,
  FiBriefcase,
  FiClock,
  FiShield,
  FiFolder,
  FiCheckSquare,
  FiCheck,
  FiCopy,
  FiLock
} from 'react-icons/fi'

export default function ProfilePage() {
  const { confirm } = useConfirm()

  usePageTitle('My Profile')
  useBreadcrumbs([{ label: 'My Profile' }])

  const { user, logout, updateUser } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const isSuperAdmin = user?.role?.name?.toLowerCase() === 'superadmin' || 
                       user?.role === 'superadmin' || 
                       user?.role?.id === 'superadmin' || 
                       user?.role?.id === 'role-mock'

  const [activeTab, setActiveTab] = useState('overview')

  // Sub-data states
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [departments, setDepartments] = useState([])

  // Filters
  const [projectFilter, setProjectFilter] = useState('all')
  const [taskFilter, setTaskFilter] = useState('all')

  // Copy states
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [copiedPhone, setCopiedPhone] = useState(false)

  // Profile Form
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [phone, setPhone] = useState(user?.phone || user?.profile_data?.mobileNumber || '')
  const [designation, setDesignation] = useState(user?.designation || user?.profile_data?.designation || '')
  const [profileSaving, setProfileSaving] = useState(false)

  // Extended Profile Data
  const profile = useMemo(() => user?.profile_data || {}, [user])

  // Password Form
  const [pwdForm, setPwdForm] = useState({ current: '', new: '', confirm: '' })
  const [pwdSaving, setPwdSaving] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setEmail(user.email || '')
      setPhone(user.phone || user.profile_data?.mobileNumber || '')
      setDesignation(user.designation || user.profile_data?.designation || '')
    }
  }, [user])

  useEffect(() => {
    if (user?.id) {
      fetchProjects()
      fetchTasks()
      fetchDepartments()
    }
  }, [user?.id])

  const fetchProjects = async () => {
    try {
      const res = await api.get(`/users/${user.id}/projects`)
      setProjects(res.data.data || [])
    } catch (err) { console.error(err) }
  }

  const fetchTasks = async () => {
    try {
      const res = await api.get(`/users/${user.id}/tasks`)
      setTasks(res.data.data || [])
    } catch (err) { console.error(err) }
  }

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/org/departments')
      setDepartments(res.data.data || [])
    } catch (err) { console.error(err) }
  }

  const userDept = useMemo(() => {
    if (!user) return 'General'
    if (user.department_name) return user.department_name
    if (user.department_id) {
      const d = departments.find(dep => dep.id === user.department_id)
      if (d) return d.name
    }
    return 'Main Studio & HQ'
  }, [user, departments])

  const handleCopy = (text, type) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    if (type === 'email') {
      setCopiedEmail(true)
      setTimeout(() => setCopiedEmail(false), 2000)
    } else {
      setCopiedPhone(true)
      setTimeout(() => setCopiedPhone(false), 2000)
    }
    toast.success('Copied to clipboard')
  }

  const handleProfileSave = async (e) => {
    e.preventDefault()

    const nameChanged = name !== (user?.name || '')
    const emailChanged = email !== (user?.email || '')
    const phoneChanged = phone !== (user?.phone || user?.profile_data?.mobileNumber || '')
    const designationChanged = designation !== (user?.designation || user?.profile_data?.designation || '')

    if (nameChanged || emailChanged || phoneChanged || designationChanged) {
      let details = []
      if (nameChanged) details.push(`Name: "${user?.name || ''}" ➔ "${name}"`)
      if (emailChanged && isSuperAdmin) details.push(`Email: "${user?.email || ''}" ➔ "${email}"`)
      if (phoneChanged) details.push(`Phone: "${user?.phone || ''}" ➔ "${phone}"`)
      if (designationChanged) details.push(`Job Title: "${user?.designation || ''}" ➔ "${designation}"`)

      if (details.length > 0) {
        const confirmMsg = `Are you sure you want to update your profile details?\n\n${details.join('\n')}`
        if (!(await confirm(confirmMsg))) {
          return
        }
      }
    }

    setProfileSaving(true)
    try {
      const payload = { name, phone, designation }
      if (isSuperAdmin) {
        payload.email = email
      }
      const response = await api.patch('/auth/me', payload)
      const updatedUser = response.data.data || response.data
      updateUser(updatedUser)
      toast.success('Profile updated successfully')
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setProfileSaving(false)
    }
  }

  const calculateStrength = (pwd) => {
    let score = 0
    if (pwd.length >= 8) score++
    if (/[A-Z]/.test(pwd)) score++
    if (/[a-z]/.test(pwd)) score++
    if (/[0-9]/.test(pwd)) score++
    if (/[^A-Za-z0-9]/.test(pwd)) score++
    return score
  }

  const pwdScore = calculateStrength(pwdForm.new)
  const strengthColor = pwdScore <= 2 ? 'var(--color-danger)' : pwdScore <= 4 ? 'var(--color-warning)' : 'var(--color-success)'
  const strengthWidth = `${(pwdScore / 5) * 100}%`

  const handlePasswordSave = async (e) => {
    e.preventDefault()
    if (pwdForm.new !== pwdForm.confirm) {
      return toast.error('New passwords do not match')
    }
    if (!(await confirm("Are you sure you want to change your password? This will sign you out of all devices."))) {
      return
    }
    setPwdSaving(true)
    try {
      await api.post('/auth/change-password', {
        currentPassword: pwdForm.current,
        newPassword: pwdForm.new
      })
      setPwdForm({ current: '', new: '', confirm: '' })
      toast.success("Password changed. You've been signed out of all devices.")
      logout()
      navigate('/login')
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error('Incorrect current password')
      } else {
        toast.error('Failed to change password')
      }
    } finally {
      setPwdSaving(false)
    }
  }

  const handleSignOutAll = async () => {
    if (await confirm('Are you sure you want to sign out of all devices?')) {
      try {
        await api.delete('/auth/sessions')
        toast.success('Signed out of all devices.')
        logout()
        navigate('/login')
      } catch {
        toast.error('Failed to sign out of all devices')
      }
    }
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (file) {
      toast.success('Profile photo updated (simulated)')
    }
  }

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (projectFilter === 'all') return true
      return p.status?.toLowerCase() === projectFilter.toLowerCase()
    })
  }, [projects, projectFilter])

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (taskFilter === 'all') return true
      return t.status?.toLowerCase() === taskFilter.toLowerCase()
    })
  }, [tasks, taskFilter])

  return (
    <div className={styles.page}>
      
      {/* Hero Header Strip */}
      <div className={styles.heroCard}>
        <div className={styles.heroAccentLine} />
        
        <div className={styles.heroMainRow}>
          <div className={styles.heroIdentityGroup}>
            <div className={styles.avatarWrapper}>
              <Avatar name={name || user?.name} size="xl" style={{ width: 80, height: 80, fontSize: 32 }} />
              <input type="file" ref={fileInputRef} className={styles.fileInput} accept="image/*" onChange={handlePhotoUpload} />
            </div>
            
            <div className={styles.heroIdentityText}>
              <div className={styles.heroNameRow}>
                <h2 className={styles.heroName}>{name || user?.name}</h2>
                <Badge variant="success">● Active</Badge>
              </div>

              <div className={styles.heroMetaRow}>
                <span className={styles.metaItem}>
                  <FiMail />
                  <span className={styles.copyableEmail} onClick={() => handleCopy(email, 'email')}>
                    {email}
                    {copiedEmail ? <FiCheck style={{ color: 'var(--color-success)' }} /> : <FiCopy className={styles.copyIcon} />}
                  </span>
                </span>
                
                <span className={styles.metaDivider}>•</span>
                <span className={styles.metaItem}>
                  <FiShield /> {user?.role?.name || user?.role || 'Team Member'}
                </span>

                <span className={styles.metaDivider}>•</span>
                <span className={styles.metaItem}>
                  <FiBriefcase /> {userDept}
                </span>

                {phone && (
                  <>
                    <span className={styles.metaDivider}>•</span>
                    <span className={styles.metaItem}>
                      <FiPhone />
                      <span className={styles.copyableEmail} onClick={() => handleCopy(phone, 'phone')}>
                        {phone}
                        {copiedPhone ? <FiCheck style={{ color: 'var(--color-success)' }} /> : <FiCopy className={styles.copyIcon} />}
                      </span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
            Change Photo
          </Button>
        </div>

        {/* Hero Workload Stats Strip */}
        <div className={styles.statsStrip}>
          <div className={styles.statTile}>
            <div className={styles.statIconWrapper}><FiFolder /></div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>{projects.length}</span>
              <span className={styles.statLabel}>Active Projects</span>
            </div>
          </div>

          <div className={styles.statTile}>
            <div className={styles.statIconWrapper}><FiCheckSquare /></div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>{tasks.length}</span>
              <span className={styles.statLabel}>Assigned Tasks</span>
            </div>
          </div>

          <div className={styles.statTile}>
            <div className={styles.statIconWrapper}><FiClock /></div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>
                {user?.weekly_capacity !== undefined && user?.weekly_capacity !== null ? user.weekly_capacity : 40} hrs
              </span>
              <span className={styles.statLabel}>Weekly Capacity</span>
            </div>
          </div>

          <div className={styles.statTile}>
            <div className={styles.statIconWrapper}><FiCalendar /></div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>
                {user?.created_at ? format(new Date(user.created_at), 'MMM yyyy') : '-'}
              </span>
              <span className={styles.statLabel}>Member Since</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className={styles.tabsNav}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <FiUser /> Overview & Personal Details
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'projects' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          <FiFolder /> My Assigned Projects ({projects.length})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'tasks' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          <FiCheckSquare /> My Assigned Tasks ({tasks.length})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'security' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <FiLock /> Password & Security
        </button>
      </div>

      {/* Dynamic Tab Content */}
      {activeTab === 'overview' && (
        <div className={styles.contentGrid}>
          {/* Left Column: Form Edit */}
          <div className={styles.column}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>Profile Information</div>
              <div className={styles.cardDesc}>Update your personal details and contact information.</div>

              <form className={styles.form} onSubmit={handleProfileSave}>
                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Full Name</label>
                    <input type="text" className={styles.input} value={name} onChange={e => setName(e.target.value)} required />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Phone Number</label>
                    <input type="tel" className={styles.input} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 234 567 8900" />
                  </div>
                </div>

                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Email Address</label>
                    <input 
                      type="email" 
                      className={`${styles.input} ${!isSuperAdmin ? styles.inputReadOnly : ''}`} 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      readOnly={!isSuperAdmin} 
                      required 
                    />
                    {!isSuperAdmin && <div className={styles.helperText}>Contact admin to change email</div>}
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Job Title / Designation</label>
                    <input type="text" className={styles.input} value={designation} onChange={e => setDesignation(e.target.value)} placeholder="e.g. Senior Designer" />
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Role</label>
                  <div>
                    <Badge variant="neutral">{user?.role?.name || user?.role || 'Team Member'}</Badge>
                  </div>
                </div>

                <button type="submit" className={styles.submitBtn} disabled={profileSaving}>
                  {profileSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Work & Organization Readonly Details */}
          <div className={styles.column}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>Work & Organization</div>
              <div className={styles.cardDesc}>Official organizational metrics and contact record.</div>

              <div className={styles.infoFieldsList}>
                <div className={styles.infoFieldRow}>
                  <span className={styles.infoFieldLabel}>Department</span>
                  <span className={styles.infoFieldValue}><Badge variant="accent">{userDept}</Badge></span>
                </div>
                <div className={styles.infoFieldRow}>
                  <span className={styles.infoFieldLabel}>Designation / Title</span>
                  <span className={styles.infoFieldValue}>{designation || profile.designation || 'Not set'}</span>
                </div>
                <div className={styles.infoFieldRow}>
                  <span className={styles.infoFieldLabel}>System Role</span>
                  <span className={styles.infoFieldValue}><Badge variant="info">{user?.role?.name || user?.role || 'Team Member'}</Badge></span>
                </div>
                <div className={styles.infoFieldRow}>
                  <span className={styles.infoFieldLabel}>Employment Type</span>
                  <span className={styles.infoFieldValue}>{profile.employmentType || 'Full-Time'}</span>
                </div>
                <div className={styles.infoFieldRow}>
                  <span className={styles.infoFieldLabel}>Work Location</span>
                  <span className={styles.infoFieldValue}>{profile.workLocation || 'Main Studio & HQ'}</span>
                </div>
                <div className={styles.infoFieldRow}>
                  <span className={styles.infoFieldLabel}>Date of Joining</span>
                  <span className={styles.infoFieldValue}>
                    {profile.joiningDate ? format(new Date(profile.joiningDate), 'MMMM dd, yyyy') : (
                      user?.created_at ? format(new Date(user.created_at), 'MMMM dd, yyyy') : 'Not provided'
                    )}
                  </span>
                </div>
                <div className={styles.infoFieldRow}>
                  <span className={styles.infoFieldLabel}>Reporting Manager</span>
                  <span className={styles.infoFieldValue}>{profile.reportingManager || 'Direct to Leadership'}</span>
                </div>
                <div className={styles.infoFieldRow}>
                  <span className={styles.infoFieldLabel}>Residential Address</span>
                  <span className={styles.infoFieldValue}>
                    {profile.address ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FiMapPin style={{ color: 'var(--color-accent)' }} /> {profile.address}
                      </span>
                    ) : 'Not provided'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Assigned Projects */}
      {activeTab === 'projects' && (
        <div className={styles.card}>
          <div className={styles.sectionHeader}>
            <div>
              <div className={styles.cardHeader}>My Assigned Projects ({projects.length})</div>
              <div className={styles.cardDesc}>Interior design and construction projects assigned to you.</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button size="sm" variant={projectFilter === 'all' ? 'primary' : 'secondary'} onClick={() => setProjectFilter('all')}>
                All ({projects.length})
              </Button>
              <Button size="sm" variant={projectFilter === 'active' ? 'primary' : 'secondary'} onClick={() => setProjectFilter('active')}>
                Active
              </Button>
              <Button size="sm" variant={projectFilter === 'completed' ? 'primary' : 'secondary'} onClick={() => setProjectFilter('completed')}>
                Completed
              </Button>
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div className={styles.emptyBox}>
              <FiFolder className={styles.emptyIcon} />
              <h4>No Projects Found</h4>
              <p>You currently have no active or matching assigned projects.</p>
            </div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.crmTable}>
                <thead>
                  <tr>
                    <th>Project Name</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Start Date</th>
                    <th>Target Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div
                          className={styles.projectLink}
                          onClick={() => navigate(`/projects/${p.id}`)}
                        >
                          {p.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>ID: {p.id.substring(0, 8)}...</div>
                      </td>
                      <td><Badge variant="neutral">{p.project_type || 'Residential'}</Badge></td>
                      <td>
                        <Badge variant={p.status === 'completed' ? 'success' : p.status === 'active' ? 'accent' : 'warning'}>
                          {p.status?.toUpperCase()}
                        </Badge>
                      </td>
                      <td>{p.start_date ? format(new Date(p.start_date), 'PP') : '-'}</td>
                      <td>{p.expected_completion_date ? format(new Date(p.expected_completion_date), 'PP') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Assigned Tasks */}
      {activeTab === 'tasks' && (
        <div className={styles.card}>
          <div className={styles.sectionHeader}>
            <div>
              <div className={styles.cardHeader}>My Assigned Tasks ({tasks.length})</div>
              <div className={styles.cardDesc}>Deliverables and action items in your queue.</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button size="sm" variant={taskFilter === 'all' ? 'primary' : 'secondary'} onClick={() => setTaskFilter('all')}>
                All ({tasks.length})
              </Button>
              <Button size="sm" variant={taskFilter === 'in_progress' ? 'primary' : 'secondary'} onClick={() => setTaskFilter('in_progress')}>
                In Progress
              </Button>
              <Button size="sm" variant={taskFilter === 'completed' ? 'primary' : 'secondary'} onClick={() => setTaskFilter('completed')}>
                Completed
              </Button>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className={styles.emptyBox}>
              <FiCheckSquare className={styles.emptyIcon} />
              <h4>No Tasks Found</h4>
              <p>Your task queue is clear.</p>
            </div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.crmTable}>
                <thead>
                  <tr>
                    <th>Task Title</th>
                    <th>Project</th>
                    <th>Priority</th>
                    <th>Due Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 600 }}>{t.title}</td>
                      <td>{t.project_name || <span style={{ color: 'var(--color-text-muted)' }}>General</span>}</td>
                      <td>
                        <Badge variant={t.priority === 'high' || t.priority === 'urgent' ? 'danger' : t.priority === 'medium' ? 'warning' : 'neutral'}>
                          {t.priority?.toUpperCase() || 'NORMAL'}
                        </Badge>
                      </td>
                      <td>{t.due_date ? format(new Date(t.due_date), 'PP') : '-'}</td>
                      <td>
                        <Badge variant={t.status === 'completed' ? 'success' : 'accent'}>
                          {t.status?.toUpperCase() || 'PENDING'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Security */}
      {activeTab === 'security' && (
        <div className={styles.contentGrid}>
          {/* Password Section */}
          <div className={styles.column}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>Change Password</div>
              <div className={styles.cardDesc}>Ensure your account is using a long, random password to stay secure.</div>

              <form className={styles.form} onSubmit={handlePasswordSave}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Current Password</label>
                  <input type="password" className={styles.input} value={pwdForm.current} onChange={e => setPwdForm({ ...pwdForm, current: e.target.value })} required />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>New Password</label>
                  <input type="password" className={styles.input} value={pwdForm.new} onChange={e => setPwdForm({ ...pwdForm, new: e.target.value })} required minLength={8} />
                  {pwdForm.new.length > 0 && (
                    <div className={styles.strengthBarContainer}>
                      <div className={styles.strengthBar} style={{ width: strengthWidth, backgroundColor: strengthColor }} />
                    </div>
                  )}
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Confirm New Password</label>
                  <input type="password" className={styles.input} value={pwdForm.confirm} onChange={e => setPwdForm({ ...pwdForm, confirm: e.target.value })} required minLength={8} />
                </div>

                <button type="submit" className={styles.submitBtn} disabled={pwdSaving}>
                  {pwdSaving ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>

          {/* Sign Out Everywhere */}
          <div className={styles.column}>
            <div className={styles.dangerCard}>
              <div className={styles.dangerBox}>
                <div className={styles.dangerInfo}>
                  <div className={styles.dangerTitle}>Sign out of all devices</div>
                  <div className={styles.dangerDesc}>Log out of all other active sessions across all your devices.</div>
                </div>
                <button className={styles.dangerBtn} onClick={handleSignOutAll}>Sign Out Everywhere</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

