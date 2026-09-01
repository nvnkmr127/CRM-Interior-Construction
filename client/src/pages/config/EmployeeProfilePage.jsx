import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import { useToast } from '../../store/toastContext'
import { useConfirm } from '../../store/confirmContext'
import { Button, Input, Select, Badge, Modal, Textarea, PermissionButton } from '../../components/ui'
import { format, formatDistanceToNow } from 'date-fns'
import styles from './EmployeeProfilePage.module.css'

import {
  FiUser,
  FiMail,
  FiPhone,
  FiCalendar,
  FiMapPin,
  FiBriefcase,
  FiAward,
  FiClock,
  FiShield,
  FiFolder,
  FiCheckSquare,
  FiFileText,
  FiMonitor,
  FiSmartphone,
  FiActivity,
  FiEdit3,
  FiSave,
  FiArrowLeft,
  FiSettings,
  FiEye,
  FiEyeOff,
  FiCopy,
  FiCheck,
  FiSliders,
  FiLayers,
  FiCheckCircle,
  FiDownload,
  FiUploadCloud,
  FiInfo,
  FiSearch,
  FiZap
} from 'react-icons/fi'

const NAVIGATION_GROUPS = [
  {
    category: 'PROFILE & DETAILS',
    items: [
      { id: 'overview', label: 'Overview', icon: <FiUser /> },
      { id: 'permissions', label: 'Role & Permissions', icon: <FiShield /> },
      { id: 'notes', label: 'Internal Notes', icon: <FiEdit3 /> },
    ]
  },
  {
    category: 'WORKSPACE ACTIVITY',
    items: [
      { id: 'projects', label: 'Assigned Projects', icon: <FiFolder />, countKey: 'projects' },
      { id: 'tasks', label: 'Assigned Tasks', icon: <FiCheckSquare />, countKey: 'tasks' },
      { id: 'timeline', label: 'Activity Timeline', icon: <FiClock /> },
      { id: 'performance', label: 'Performance & KPIs', icon: <FiAward /> },
    ]
  },
  {
    category: 'SECURITY & GOVERNANCE',
    items: [
      { id: 'login-history', label: 'Login History', icon: <FiActivity /> },
      { id: 'devices', label: 'Active Devices', icon: <FiSmartphone />, countKey: 'devices' },
      { id: 'audit-logs', label: 'Audit Logs', icon: <FiFileText /> },
    ]
  },
  {
    category: 'HR & WORKFORCE',
    items: [
      { id: 'documents', label: 'Documents', icon: <FiFileText /> },
      { id: 'attendance', label: 'Attendance & Leave', icon: <FiCalendar /> },
    ]
  }
]

const DEFAULT_ROLE_OPTIONS = [
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'pm', label: 'Project Manager' },
  { value: 'designer', label: 'Designer' },
  { value: 'sales', label: 'Sales' }
]

const EMPLOYMENT_TYPES = [
  { value: 'Full-Time', label: 'Full-Time Employee' },
  { value: 'Contract', label: 'Contract / Consultant' },
  { value: 'Part-Time', label: 'Part-Time' },
  { value: 'Intern', label: 'Internship' },
  { value: 'Probation', label: 'Probationary' }
]

export default function EmployeeProfilePage({ userId, onBack, onConfigureMock }) {
  const { confirm } = useConfirm()
  const params = useParams()
  const id = userId || params.id
  const navigate = useNavigate()
  const toast = useToast()

  const [activeSection, setActiveSection] = useState('overview')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [copiedPhone, setCopiedPhone] = useState(false)

  // Sub-data states
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [sessions, setSessions] = useState([])
  const [loginHistory, setLoginHistory] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [timelineEvents, setTimelineEvents] = useState([])
  const [departments, setDepartments] = useState([])

  // Search & Filters inside tabs
  const [timelineFilter, setTimelineFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [taskFilter, setTaskFilter] = useState('all')
  const [auditSearch, setAuditSearch] = useState('')

  // Edit mode for profile
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({})

  // Account Settings Modal
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [roles, setRoles] = useState([])
  const [accountForm, setAccountForm] = useState({
    email: '',
    role_id: '',
    status: '',
    department_id: '',
    weekly_capacity: 40,
    password: ''
  })

  // Document Upload Modal state
  const [isUploadDocOpen, setIsUploadDocOpen] = useState(false)
  const [newDocForm, setNewDocForm] = useState({ title: '', category: 'Identification', file: null })

  useEffect(() => {
    fetchUserData()
    fetchMetadata()
  }, [id])

  useEffect(() => {
    if (!user) return
    if (activeSection === 'projects' && projects.length === 0) fetchProjects()
    if (activeSection === 'tasks' && tasks.length === 0) fetchTasks()
    if (activeSection === 'devices' && sessions.length === 0) fetchSessions()
    if (activeSection === 'login-history' && loginHistory.length === 0) fetchLoginHistory()
    if (activeSection === 'audit-logs' && auditLogs.length === 0) fetchAuditLogs()
    if (activeSection === 'timeline' && timelineEvents.length === 0) fetchTimelineEvents()
  }, [activeSection, user])

  const fetchUserData = async () => {
    try {
      setLoading(true)
      const res = await api.get(`/users/${id}`)
      const userData = res.data.data
      setUser(userData)
      setEditForm(JSON.parse(JSON.stringify(userData)))
      setAccountForm({
        email: userData.email || '',
        role_id: userData.role_id || userData.role || '',
        status: userData.status || 'active',
        department_id: userData.department_id || '',
        weekly_capacity: userData.weekly_capacity !== undefined && userData.weekly_capacity !== null ? userData.weekly_capacity : 40,
        password: ''
      })
    } catch (err) {
      toast.error('Failed to load user profile')
      if (onBack) onBack()
      else navigate('/team/members')
    } finally {
      setLoading(false)
    }
  }

  const fetchMetadata = async () => {
    try {
      const [rolesRes, deptRes] = await Promise.allSettled([
        api.get('/roles'),
        api.get('/org/departments')
      ])
      if (rolesRes.status === 'fulfilled') setRoles(rolesRes.value.data.data || [])
      if (deptRes.status === 'fulfilled') setDepartments(deptRes.value.data.data || [])
    } catch (err) {
      console.error(err)
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
    toast.success(`Copied to clipboard`)
  }

  const handleRevokeSession = async (sessionId) => {
    if (!await confirm('Are you sure you want to forcefully revoke this active session? The user will be immediately logged out on that device.')) return
    try {
      await api.delete(`/sessions/force-logout/${sessionId}`)
      toast.success('Session revoked successfully')
      fetchSessions()
      fetchLoginHistory()
    } catch (err) {
      toast.error('Failed to revoke session')
    }
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const payload = {
        name: editForm.name,
        avatar_url: editForm.avatar_url,
        weekly_capacity: editForm.weekly_capacity !== undefined ? Number(editForm.weekly_capacity) : 40,
        department_id: editForm.department_id || null,
        profile_data: editForm.profile_data || {}
      }

      const res = await api.patch(`/users/${id}`, payload)
      const updatedUser = res.data.data || { ...user, ...payload }
      setUser(updatedUser)
      setEditForm(JSON.parse(JSON.stringify(updatedUser)))
      setIsEditing(false)
      toast.success('Profile details updated successfully')
    } catch (err) {
      toast.error('Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSaveAccountSettings = async () => {
    try {
      const selectedRoleObj = roles.find(r => r.id === accountForm.role_id) || DEFAULT_ROLE_OPTIONS.find(d => d.value === accountForm.role_id)
      const roleName = selectedRoleObj ? (selectedRoleObj.name || selectedRoleObj.label) : ''

      const patchData = {
        email: accountForm.email,
        role_id: accountForm.role_id,
        role_name: roleName,
        role: accountForm.role_id,
        status: accountForm.status,
        department_id: accountForm.department_id || null,
        weekly_capacity: accountForm.weekly_capacity ? Number(accountForm.weekly_capacity) : 40
      }

      if (accountForm.password && accountForm.password.trim() !== '') {
        patchData.password = accountForm.password.trim()
      }

      await api.patch(`/users/${id}`, patchData)
      toast.success('Account settings updated successfully')
      setIsAccountSettingsOpen(false)
      fetchUserData()
    } catch (err) {
      toast.error('Failed to update account settings')
    }
  }

  const getStatusBadgeVariant = (status) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'success'
      case 'probation':
      case 'pending_approval':
      case 'pending': return 'warning'
      case 'suspended':
      case 'terminated':
      case 'locked': return 'danger'
      default: return 'neutral'
    }
  }

  const getStatusDotClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'active': return styles.statusActive
      case 'probation':
      case 'pending_approval': return styles.statusProbation
      case 'suspended':
      case 'terminated':
      case 'locked': return styles.statusSuspended
      default: return styles.statusInactive
    }
  }

  const roleOptions = useMemo(() => {
    const list = [
      ...roles.map(r => ({ value: r.id, label: r.name })),
      ...DEFAULT_ROLE_OPTIONS.filter(d => !roles.some(r => r.id === d.value || r.name?.toLowerCase() === d.label?.toLowerCase()))
    ]
    return list
  }, [roles])

  const departmentOptions = useMemo(() => {
    return [
      { value: '', label: 'None / General' },
      ...departments.map(d => ({ value: d.id, label: d.name }))
    ]
  }, [departments])

  const profile = user?.profile_data || {}
  const formProfile = editForm?.profile_data || {}

  // Active counts for left nav tabs
  const activeSessionsCount = sessions.filter(s => new Date(s.expires_at) > new Date()).length

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.skeletonHeader} />
        <div className={styles.skeletonBody} />
      </div>
    )
  }

  if (!user) return null

  const renderOverviewSection = () => {
    if (isEditing) {
      return (
        <div className={styles.editFormContainer}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <h3 className={styles.sectionTitle}>Edit Employee Profile</h3>
              <p className={styles.sectionDesc}>Update personal information, work credentials, and emergency details.</p>
            </div>
          </div>

          <div className={styles.formSectionCard}>
            <h4 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
              Core Personal Information
            </h4>
            <div className={styles.formGrid}>
              <Input
                label="Full Name"
                required
                value={editForm.name || ''}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
              />
              <Input
                label="Date of Birth"
                type="date"
                value={formProfile.dob || ''}
                onChange={e => setEditForm({ ...editForm, profile_data: { ...formProfile, dob: e.target.value } })}
              />
              <Input
                label="Gender"
                placeholder="e.g. Male / Female / Other"
                value={formProfile.gender || ''}
                onChange={e => setEditForm({ ...editForm, profile_data: { ...formProfile, gender: e.target.value } })}
              />
              <Input
                label="Blood Group"
                placeholder="e.g. O+, A+, B+"
                value={formProfile.bloodGroup || ''}
                onChange={e => setEditForm({ ...editForm, profile_data: { ...formProfile, bloodGroup: e.target.value } })}
              />
              <Input
                label="Avatar Image URL"
                placeholder="https://..."
                value={editForm.avatar_url || ''}
                onChange={e => setEditForm({ ...editForm, avatar_url: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.formSectionCard}>
            <h4 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
              Work & Organization Details
            </h4>
            <div className={styles.formGrid}>
              <Select
                label="Department"
                value={editForm.department_id || ''}
                options={departmentOptions}
                onChange={val => setEditForm({ ...editForm, department_id: val })}
              />
              <Input
                label="Designation / Job Title"
                placeholder="e.g. Senior Interior Designer"
                value={formProfile.designation || ''}
                onChange={e => setEditForm({ ...editForm, profile_data: { ...formProfile, designation: e.target.value } })}
              />
              <Select
                label="Employment Type"
                value={formProfile.employmentType || 'Full-Time'}
                options={EMPLOYMENT_TYPES}
                onChange={val => setEditForm({ ...editForm, profile_data: { ...formProfile, employmentType: val } })}
              />
              <Input
                label="Date of Joining"
                type="date"
                value={formProfile.joiningDate || ''}
                onChange={e => setEditForm({ ...editForm, profile_data: { ...formProfile, joiningDate: e.target.value } })}
              />
              <Input
                label="Weekly Work Capacity (Hours)"
                type="number"
                min="0"
                max="168"
                value={editForm.weekly_capacity !== undefined ? editForm.weekly_capacity : 40}
                onChange={e => setEditForm({ ...editForm, weekly_capacity: e.target.value })}
              />
              <Input
                label="Work Location / Branch"
                placeholder="e.g. Head Office / Studio A"
                value={formProfile.workLocation || ''}
                onChange={e => setEditForm({ ...editForm, profile_data: { ...formProfile, workLocation: e.target.value } })}
              />
              <Input
                label="Reporting Manager"
                placeholder="e.g. Sarah Jenkins"
                value={formProfile.reportingManager || ''}
                onChange={e => setEditForm({ ...editForm, profile_data: { ...formProfile, reportingManager: e.target.value } })}
              />
            </div>
          </div>

          <div className={styles.formSectionCard}>
            <h4 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
              Contact & Emergency Information
            </h4>
            <div className={styles.formGrid}>
              <Input
                label="Mobile / Phone Number"
                placeholder="+91 ..."
                value={formProfile.mobileNumber || ''}
                onChange={e => setEditForm({ ...editForm, profile_data: { ...formProfile, mobileNumber: e.target.value } })}
              />
              <Input
                label="Personal / Alternate Email"
                type="email"
                placeholder="personal@gmail.com"
                value={formProfile.alternateEmail || ''}
                onChange={e => setEditForm({ ...editForm, profile_data: { ...formProfile, alternateEmail: e.target.value } })}
              />
              <Input
                label="Emergency Contact Name"
                placeholder="Name of contact"
                value={formProfile.emergencyContactName || ''}
                onChange={e => setEditForm({ ...editForm, profile_data: { ...formProfile, emergencyContactName: e.target.value } })}
              />
              <Input
                label="Emergency Phone"
                placeholder="Emergency number"
                value={formProfile.emergencyContactPhone || ''}
                onChange={e => setEditForm({ ...editForm, profile_data: { ...formProfile, emergencyContactPhone: e.target.value } })}
              />
              <div className={styles.formFullWidth}>
                <Input
                  label="Residential Address"
                  placeholder="Full street address, city, state, postal code"
                  value={formProfile.address || ''}
                  onChange={e => setEditForm({ ...editForm, profile_data: { ...formProfile, address: e.target.value } })}
                />
              </div>
            </div>
          </div>

          <div className={styles.formActionsBar}>
            <Button
              variant="secondary"
              onClick={() => {
                setIsEditing(false)
                setEditForm(JSON.parse(JSON.stringify(user)))
              }}
              disabled={savingProfile}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveProfile}
              loading={savingProfile}
            >
              Save Profile Changes
            </Button>
          </div>
        </div>
      )
    }

    const deptName = departments.find(d => d.id === user.department_id)?.name || profile.department || 'Not Assigned'

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <h3 className={styles.sectionTitle}>Personal & Work Overview</h3>
            <p className={styles.sectionDesc}>Core employee records, organization structure, and verified contact credentials.</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setIsEditing(true)}
            icon={<FiEdit3 />}
          >
            Edit Profile
          </Button>
        </div>

        <div className={styles.infoCardsGrid}>
          {/* Card 1: Personal Details */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>
              <span className={styles.infoCardIcon}><FiUser /></span>
              <h4 className={styles.infoCardTitle}>Personal Details</h4>
            </div>
            <div className={styles.infoFieldsList}>
              <div className={styles.infoFieldRow}>
                <span className={styles.infoFieldLabel}>Full Legal Name</span>
                <span className={styles.infoFieldValue}>{user.name || <span className={styles.emptyValue}>Not provided</span>}</span>
              </div>
              <div className={styles.infoFieldRow}>
                <span className={styles.infoFieldLabel}>Date of Birth</span>
                <span className={styles.infoFieldValue}>
                  {profile.dob ? format(new Date(profile.dob), 'MMMM dd, yyyy') : <span className={styles.emptyValue}>Not provided</span>}
                </span>
              </div>
              <div className={styles.infoFieldRow}>
                <span className={styles.infoFieldLabel}>Gender</span>
                <span className={styles.infoFieldValue}>{profile.gender || <span className={styles.emptyValue}>Not specified</span>}</span>
              </div>
              <div className={styles.infoFieldRow}>
                <span className={styles.infoFieldLabel}>Blood Group</span>
                <span className={styles.infoFieldValue}>{profile.bloodGroup || <span className={styles.emptyValue}>Not recorded</span>}</span>
              </div>
              <div className={styles.infoFieldRow}>
                <span className={styles.infoFieldLabel}>Emergency Contact</span>
                <span className={styles.infoFieldValue}>
                  {profile.emergencyContactName ? (
                    `${profile.emergencyContactName} (${profile.emergencyContactPhone || 'No Phone'})`
                  ) : (
                    <span className={styles.emptyValue}>Not provided</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Work & Employment */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>
              <span className={styles.infoCardIcon}><FiBriefcase /></span>
              <h4 className={styles.infoCardTitle}>Work & Organization</h4>
            </div>
            <div className={styles.infoFieldsList}>
              <div className={styles.infoFieldRow}>
                <span className={styles.infoFieldLabel}>Department</span>
                <span className={styles.infoFieldValue}>
                  <Badge variant="accent">{deptName}</Badge>
                </span>
              </div>
              <div className={styles.infoFieldRow}>
                <span className={styles.infoFieldLabel}>Designation / Title</span>
                <span className={styles.infoFieldValue}>{profile.designation || user.role_name || <span className={styles.emptyValue}>Not set</span>}</span>
              </div>
              <div className={styles.infoFieldRow}>
                <span className={styles.infoFieldLabel}>System Role</span>
                <span className={styles.infoFieldValue}>
                  <Badge variant="info">{user.role_name || 'Designer'}</Badge>
                </span>
              </div>
              <div className={styles.infoFieldRow}>
                <span className={styles.infoFieldLabel}>Employment Type</span>
                <span className={styles.infoFieldValue}>{profile.employmentType || 'Full-Time'}</span>
              </div>
              <div className={styles.infoFieldRow}>
                <span className={styles.infoFieldLabel}>Date of Joining</span>
                <span className={styles.infoFieldValue}>
                  {profile.joiningDate ? format(new Date(profile.joiningDate), 'MMMM dd, yyyy') : (
                    user.created_at ? format(new Date(user.created_at), 'MMMM dd, yyyy') : <span className={styles.emptyValue}>Not provided</span>
                  )}
                </span>
              </div>
              <div className={styles.infoFieldRow}>
                <span className={styles.infoFieldLabel}>Reporting Manager</span>
                <span className={styles.infoFieldValue}>{profile.reportingManager || <span className={styles.emptyValue}>Direct to Leadership</span>}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Contact & Location */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>
              <span className={styles.infoCardIcon}><FiMail /></span>
              <h4 className={styles.infoCardTitle}>Contact & Location</h4>
            </div>
            <div className={styles.infoFieldsList}>
              <div className={styles.infoFieldRow}>
                <span className={styles.infoFieldLabel}>Official Email Address</span>
                <span className={styles.infoFieldValue}>
                  <span
                    className={styles.copyableEmail}
                    onClick={() => handleCopy(user.email, 'email')}
                    title="Click to copy email"
                  >
                    {user.email}
                    {copiedEmail ? <FiCheck style={{ color: 'var(--color-success)' }} /> : <FiCopy className={styles.copyIcon} />}
                  </span>
                </span>
              </div>
              <div className={styles.infoFieldRow}>
                <span className={styles.infoFieldLabel}>Primary Phone / Mobile</span>
                <span className={styles.infoFieldValue}>
                  {profile.mobileNumber ? (
                    <span
                      className={styles.copyableEmail}
                      onClick={() => handleCopy(profile.mobileNumber, 'phone')}
                      title="Click to copy phone"
                    >
                      {profile.mobileNumber}
                      {copiedPhone ? <FiCheck style={{ color: 'var(--color-success)' }} /> : <FiCopy className={styles.copyIcon} />}
                    </span>
                  ) : (
                    <span className={styles.emptyValue}>Not provided</span>
                  )}
                </span>
              </div>
              <div className={styles.infoFieldRow}>
                <span className={styles.infoFieldLabel}>Personal Alternate Email</span>
                <span className={styles.infoFieldValue}>{profile.alternateEmail || <span className={styles.emptyValue}>Not provided</span>}</span>
              </div>
              <div className={styles.infoFieldRow}>
                <span className={styles.infoFieldLabel}>Work Location / Branch</span>
                <span className={styles.infoFieldValue}>{profile.workLocation || 'Main Studio & HQ'}</span>
              </div>
              <div className={styles.infoFieldRow}>
                <span className={styles.infoFieldLabel}>Residential Address</span>
                <span className={styles.infoFieldValue}>
                  {profile.address ? (
                    <span style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                      <FiMapPin style={{ flexShrink: 0, marginTop: '3px', color: 'var(--color-accent)' }} />
                      {profile.address}
                    </span>
                  ) : (
                    <span className={styles.emptyValue}>Not provided</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Workload & Capacity */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>
              <span className={styles.infoCardIcon}><FiClock /></span>
              <h4 className={styles.infoCardTitle}>Workload & Allocation</h4>
            </div>
            <div className={styles.infoFieldsList}>
              <div className={styles.infoFieldRow}>
                <span className={styles.infoFieldLabel}>Weekly Working Capacity</span>
                <span className={styles.infoFieldValue} style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-accent-dark)' }}>
                  {user.weekly_capacity !== undefined && user.weekly_capacity !== null ? user.weekly_capacity : 40} hrs / week
                </span>
              </div>
              <div className={styles.infoFieldRow}>
                <span className={styles.infoFieldLabel}>Active Projects Assigned</span>
                <span className={styles.infoFieldValue}>
                  <Badge variant={projects.length > 0 ? 'accent' : 'neutral'}>
                    {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
                  </Badge>
                </span>
              </div>
              <div className={styles.infoFieldRow}>
                <span className={styles.infoFieldLabel}>Open Tasks Queue</span>
                <span className={styles.infoFieldValue}>
                  <Badge variant={tasks.length > 0 ? 'warning' : 'success'}>
                    {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
                  </Badge>
                </span>
              </div>
              <div className={styles.infoFieldRow}>
                <span className={styles.infoFieldLabel}>Availability Status</span>
                <span className={styles.infoFieldValue}>
                  <Badge variant="success">● Available for Work</Badge>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderTimelineSection = () => {
    const filteredEvents = timelineEvents.filter(e => {
      if (timelineFilter === 'all') return true
      if (timelineFilter === 'projects') return e.type?.includes('project')
      if (timelineFilter === 'tasks') return e.type?.includes('task')
      if (timelineFilter === 'security') return e.type?.includes('login') || e.type?.includes('password') || e.type?.includes('session')
      return true
    })

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <h3 className={styles.sectionTitle}>Employee Activity Timeline</h3>
            <p className={styles.sectionDesc}>Chronological history of assignments, status transitions, and audit records.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant={timelineFilter === 'all' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTimelineFilter('all')}
            >
              All Events
            </Button>
            <Button
              variant={timelineFilter === 'projects' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTimelineFilter('projects')}
            >
              Projects
            </Button>
            <Button
              variant={timelineFilter === 'tasks' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTimelineFilter('tasks')}
            >
              Tasks
            </Button>
            <Button
              variant={timelineFilter === 'security' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTimelineFilter('security')}
            >
              Security
            </Button>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className={styles.emptyStateBox}>
            <FiClock className={styles.emptyStateIcon} />
            <h4 className={styles.emptyStateTitle}>No Timeline Events Recorded</h4>
            <p className={styles.emptyStateDesc}>Activity and assignment events will automatically appear here as actions occur across the workspace.</p>
          </div>
        ) : (
          <div className={styles.timelineContainer}>
            {filteredEvents.map(event => (
              <div key={event.id} className={styles.timelineItem}>
                <div className={styles.timelineNode}>
                  {event.type?.includes('project') ? <FiFolder /> :
                   event.type?.includes('task') ? <FiCheckSquare /> :
                   event.type?.includes('login') || event.type?.includes('password') ? <FiShield /> :
                   <FiActivity />}
                </div>
                <div className={styles.timelineContent}>
                  <div>
                    <h5 className={styles.timelineTitle}>{event.title}</h5>
                    <p className={styles.timelineDesc}>{event.description}</p>
                    <span className={styles.timelineActor}>
                      <FiUser /> {event.actor_name || 'System Operator'}
                    </span>
                  </div>
                  <div className={styles.timelineDate}>
                    {event.timestamp && !isNaN(new Date(event.timestamp).getTime()) ? (
                      formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })
                    ) : '-'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderProjectsSection = () => {
    const filteredProjects = projects.filter(p => {
      if (projectFilter === 'all') return true
      return p.status?.toLowerCase() === projectFilter.toLowerCase()
    })

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <h3 className={styles.sectionTitle}>
              Assigned Projects ({projects.length})
            </h3>
            <p className={styles.sectionDesc}>Active and completed interior design and construction engagements assigned to this team member.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant={projectFilter === 'all' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setProjectFilter('all')}
            >
              All ({projects.length})
            </Button>
            <Button
              variant={projectFilter === 'active' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setProjectFilter('active')}
            >
              Active
            </Button>
            <Button
              variant={projectFilter === 'completed' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setProjectFilter('completed')}
            >
              Completed
            </Button>
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className={styles.emptyStateBox}>
            <FiFolder className={styles.emptyStateIcon} />
            <h4 className={styles.emptyStateTitle}>No Projects Found</h4>
            <p className={styles.emptyStateDesc}>This team member currently has no projects assigned. You can assign them as Project Manager or Designer from the Projects module.</p>
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
                      <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{p.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>ID: {p.id.substring(0, 8)}...</div>
                    </td>
                    <td>
                      <Badge variant="neutral">{p.project_type || 'Residential'}</Badge>
                    </td>
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
    )
  }

  const renderTasksSection = () => {
    const filteredTasks = tasks.filter(t => {
      if (taskFilter === 'all') return true
      return t.status?.toLowerCase() === taskFilter.toLowerCase()
    })

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <h3 className={styles.sectionTitle}>Assigned Tasks ({tasks.length})</h3>
            <p className={styles.sectionDesc}>Action items, design milestones, and deliverables assigned across active projects.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant={taskFilter === 'all' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTaskFilter('all')}
            >
              All ({tasks.length})
            </Button>
            <Button
              variant={taskFilter === 'in_progress' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTaskFilter('in_progress')}
            >
              In Progress
            </Button>
            <Button
              variant={taskFilter === 'completed' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTaskFilter('completed')}
            >
              Completed
            </Button>
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className={styles.emptyStateBox}>
            <FiCheckSquare className={styles.emptyStateIcon} />
            <h4 className={styles.emptyStateTitle}>No Tasks Assigned</h4>
            <p className={styles.emptyStateDesc}>All task queues are clear for this team member.</p>
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
                    <td>
                      {t.due_date ? format(new Date(t.due_date), 'PP') : '-'}
                    </td>
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
    )
  }

  const renderPermissionsSection = () => {
    const rawPermissions = user.permissions || []
    const permList = Array.isArray(rawPermissions)
      ? rawPermissions
      : (typeof rawPermissions === 'object' ? (rawPermissions.actions || []) : [])

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <h3 className={styles.sectionTitle}>Role & Module Permissions</h3>
            <p className={styles.sectionDesc}>Access control policies, module grants, and action privileges for this account.</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setIsAccountSettingsOpen(true)}
            icon={<FiShield />}
          >
            Change Role
          </Button>
        </div>

        <div className={styles.infoCard}>
          <div className={styles.infoCardHeader}>
            <span className={styles.infoCardIcon}><FiShield /></span>
            <h4 className={styles.infoCardTitle}>Assigned Role Overview</h4>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
                {user.role_name || 'Standard User'}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Role ID: <code>{user.role_id || user.role || 'default'}</code>
              </div>
            </div>
            <Badge variant="accent">Effective Permissions Active</Badge>
          </div>
        </div>

        <div className={styles.infoCard}>
          <div className={styles.infoCardHeader}>
            <span className={styles.infoCardIcon}><FiLayers /></span>
            <h4 className={styles.infoCardTitle}>Action Privileges ({permList.length})</h4>
          </div>
          {permList.length === 0 ? (
            <div className={styles.emptyStateBox} style={{ padding: 'var(--space-6)' }}>
              <FiInfo className={styles.emptyStateIcon} style={{ fontSize: '24px' }} />
              <p className={styles.emptyStateDesc}>This role has standard default permissions inherited from the tenant policy.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {permList.map((p, idx) => (
                <Badge key={idx} variant="neutral" style={{ padding: '4px 10px', fontSize: '12px' }}>
                  <FiCheck style={{ color: 'var(--color-success)', marginRight: '4px' }} />
                  {p}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderLoginHistorySection = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <h3 className={styles.sectionTitle}>Login & Security History</h3>
            <p className={styles.sectionDesc}>Authentication audits, client IP records, browser devices, and session durations.</p>
          </div>
        </div>

        {loginHistory.length === 0 ? (
          <div className={styles.emptyStateBox}>
            <FiActivity className={styles.emptyStateIcon} />
            <h4 className={styles.emptyStateTitle}>No Login Records Found</h4>
            <p className={styles.emptyStateDesc}>Authentication attempts will be logged automatically when the user logs in.</p>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.crmTable}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>IP Address</th>
                  <th>Device & Browser</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Security Action</th>
                </tr>
              </thead>
              <tbody>
                {loginHistory.map(lh => (
                  <tr key={lh.id}>
                    <td>{lh.login_time && !isNaN(new Date(lh.login_time).getTime()) ? format(new Date(lh.login_time), 'PP p') : '-'}</td>
                    <td>
                      <code>{lh.ip_address || '127.0.0.1'}</code>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {lh.device?.toLowerCase()?.includes('mobile') ? <FiSmartphone /> : <FiMonitor />}
                        <span style={{ fontWeight: 500 }}>{lh.device || 'Desktop'}</span>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>({lh.browser || 'Browser'})</span>
                      </div>
                    </td>
                    <td>
                      {!lh.logout_time ? (
                        lh.active_session_id ? <Badge variant="success">Active Session</Badge> : <span style={{ color: 'var(--color-text-muted)' }}>Expired</span>
                      ) : (
                        `${Math.floor((lh.duration_seconds || 0) / 60)}m ${(lh.duration_seconds || 0) % 60}s`
                      )}
                    </td>
                    <td>
                      {lh.status === 'success' ? (
                        <Badge variant="success">Success</Badge>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <Badge variant="danger">Failed</Badge>
                          {lh.failure_reason && <span style={{ fontSize: '11px', color: 'var(--color-danger)' }}>{lh.failure_reason}</span>}
                        </div>
                      )}
                    </td>
                    <td>
                      {lh.status === 'success' && !lh.logout_time && lh.active_session_id && (
                        <PermissionButton
                          permission="users:force_logout"
                          variant="danger"
                          size="sm"
                          onClick={() => handleRevokeSession(lh.active_session_id)}
                        >
                          Revoke
                        </PermissionButton>
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
  }

  const renderDevicesSection = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <h3 className={styles.sectionTitle}>Active Connected Devices ({activeSessionsCount})</h3>
            <p className={styles.sectionDesc}>Manage authorized browser sessions and revoke active access on compromised devices.</p>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className={styles.emptyStateBox}>
            <FiSmartphone className={styles.emptyStateIcon} />
            <h4 className={styles.emptyStateTitle}>No Active Sessions</h4>
            <p className={styles.emptyStateDesc}>This user currently has no active login sessions registered.</p>
          </div>
        ) : (
          <div className={styles.deviceGrid}>
            {sessions.map(s => {
              const isActive = new Date(s.expires_at) > new Date()
              return (
                <div key={s.id} className={styles.deviceCard}>
                  <div className={styles.deviceHeader}>
                    <div className={styles.deviceInfoGroup}>
                      <div className={styles.deviceIconBox}>
                        <FiMonitor />
                      </div>
                      <div>
                        <div className={styles.deviceName}>Active Browser Session</div>
                        <div className={styles.deviceSubText}>IP: <code>{s.ip_address || '127.0.0.1'}</code></div>
                      </div>
                    </div>
                    <Badge variant={isActive ? 'success' : 'neutral'}>
                      {isActive ? 'Active' : 'Expired'}
                    </Badge>
                  </div>

                  <div className={styles.deviceMetaList}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <strong>User Agent:</strong> {s.user_agent || 'Mozilla Standard Client'}
                    </div>
                    <div>
                      <strong>Last Active:</strong> {s.last_active_at ? format(new Date(s.last_active_at), 'PP p') : '-'}
                    </div>
                  </div>

                  {isActive && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
                      <PermissionButton
                        permission="users:force_logout"
                        variant="danger"
                        size="sm"
                        onClick={() => handleRevokeSession(s.id)}
                      >
                        Force Revoke Access
                      </PermissionButton>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const renderAuditLogsSection = () => {
    const filteredLogs = auditLogs.filter(l => {
      if (!auditSearch) return true
      const q = auditSearch.toLowerCase()
      return (
        l.action?.toLowerCase().includes(q) ||
        l.entity?.toLowerCase().includes(q) ||
        l.ip_address?.toLowerCase().includes(q)
      )
    })

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <h3 className={styles.sectionTitle}>Audit Trail Logs</h3>
            <p className={styles.sectionDesc}>Immutable records of administrative and entity actions performed by or on this employee.</p>
          </div>
          <div style={{ width: '260px' }}>
            <Input
              placeholder="Search audit actions..."
              value={auditSearch}
              onChange={e => setAuditSearch(e.target.value)}
              leftIcon={<FiSearch />}
            />
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className={styles.emptyStateBox}>
            <FiFileText className={styles.emptyStateIcon} />
            <h4 className={styles.emptyStateTitle}>No Audit Logs Found</h4>
            <p className={styles.emptyStateDesc}>System security and audit events for this employee will appear here.</p>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.crmTable}>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Target Entity</th>
                  <th>Changes Summary</th>
                  <th>Device / IP</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(l => (
                  <tr key={l.id}>
                    <td>
                      <Badge variant="accent">{l.action}</Badge>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{l.entity}</span>
                      {l.entity_id && <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: '4px' }}>({l.entity_id.substring(0, 8)}...)</span>}
                    </td>
                    <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px' }}>
                      {l.old_value || l.new_value ? 'Record modified (view details)' : '-'}
                    </td>
                    <td>
                      <code>{l.ip_address || '-'}</code>
                    </td>
                    <td>{l.created_at && !isNaN(new Date(l.created_at).getTime()) ? format(new Date(l.created_at), 'PP p') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  const renderInternalNotesSection = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <h3 className={styles.sectionTitle}>Internal HR & Management Notes</h3>
            <p className={styles.sectionDesc}>Confidential administrative commentary, performance reviews, and manager observations.</p>
          </div>
          {!isEditing ? (
            <Button variant="secondary" onClick={() => setIsEditing(true)} icon={<FiEdit3 />}>
              Edit Notes
            </Button>
          ) : (
            <Button variant="primary" onClick={handleSaveProfile} loading={savingProfile} icon={<FiSave />}>
              Save Notes
            </Button>
          )}
        </div>

        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Textarea
              label="Confidential Notes Content"
              value={formProfile.internalNotes || ''}
              onChange={e => setEditForm({ ...editForm, profile_data: { ...formProfile, internalNotes: e.target.value } })}
              rows={12}
              placeholder="Record employee performance insights, 1:1 discussion logs, or administrative flags..."
            />
          </div>
        ) : (
          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>
              <span className={styles.infoCardIcon}><FiEdit3 /></span>
              <h4 className={styles.infoCardTitle}>Confidential Administration Log</h4>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', color: 'var(--color-text)', minHeight: '180px' }}>
              {profile.internalNotes || (
                <span className={styles.emptyValue}>No internal notes recorded yet for this employee. Click "Edit Notes" to write notes.</span>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderDocumentsSection = () => {
    const sampleDocs = [
      { id: '1', title: 'National Identity / Passport', type: 'Identification', status: 'verified', updated: '2026-01-15' },
      { id: '2', title: 'Signed Employment Contract', type: 'Agreement', status: 'verified', updated: '2026-01-15' },
      { id: '3', title: 'Degree & Professional Certifications', type: 'Academic', status: 'verified', updated: '2026-01-20' },
      { id: '4', title: 'Non-Disclosure Agreement (NDA)', type: 'Legal', status: 'verified', updated: '2026-01-15' },
      { id: '5', title: 'Tax Exemption Form W-4 / PAN', type: 'Taxation', status: 'pending', updated: '2026-02-01' }
    ]

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <h3 className={styles.sectionTitle}>Employee Documents & Compliance</h3>
            <p className={styles.sectionDesc}>Verification documents, identification proofs, and signed employment agreements.</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setIsUploadDocOpen(true)}
            icon={<FiUploadCloud />}
          >
            Upload Document
          </Button>
        </div>

        <div className={styles.docGrid}>
          {sampleDocs.map(doc => (
            <div key={doc.id} className={styles.docCard}>
              <div className={styles.docCardTop}>
                <div className={styles.docIconBox}>
                  <FiFileText />
                </div>
                <div className={styles.docDetails}>
                  <div className={styles.docTitle}>{doc.title}</div>
                  <div className={styles.docMeta}>Category: {doc.type}</div>
                  <div className={styles.docMeta}>Updated: {format(new Date(doc.updated), 'PP')}</div>
                </div>
              </div>
              <div className={styles.docActions}>
                <Badge variant={doc.status === 'verified' ? 'success' : 'warning'}>
                  {doc.status === 'verified' ? 'Verified' : 'Pending Review'}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => toast.success(`Viewing ${doc.title}`)}>
                  <FiDownload /> View
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderAttendanceSection = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <h3 className={styles.sectionTitle}>Attendance & Leave Records</h3>
            <p className={styles.sectionDesc}>Summary of monthly present days, paid leave balance, and recent leave requests.</p>
          </div>
        </div>

        <div className={styles.statsStrip} style={{ borderTop: 'none', paddingTop: 0 }}>
          <div className={styles.statTile}>
            <div className={styles.statIconWrapper} style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
              <FiCheckCircle />
            </div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>98.2%</span>
              <span className={styles.statLabel}>Attendance Rate</span>
            </div>
          </div>

          <div className={styles.statTile}>
            <div className={styles.statIconWrapper}>
              <FiCalendar />
            </div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>22 Days</span>
              <span className={styles.statLabel}>Present This Month</span>
            </div>
          </div>

          <div className={styles.statTile}>
            <div className={styles.statIconWrapper} style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
              <FiClock />
            </div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>2 Days</span>
              <span className={styles.statLabel}>Leaves Taken</span>
            </div>
          </div>

          <div className={styles.statTile}>
            <div className={styles.statIconWrapper}>
              <FiAward />
            </div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>14 Days</span>
              <span className={styles.statLabel}>Available Balance</span>
            </div>
          </div>
        </div>

        <div className={styles.infoCard}>
          <div className={styles.infoCardHeader}>
            <span className={styles.infoCardIcon}><FiCalendar /></span>
            <h4 className={styles.infoCardTitle}>Recent Leave Requests</h4>
          </div>
          <div className={styles.tableContainer} style={{ border: 'none' }}>
            <table className={styles.crmTable}>
              <thead>
                <tr>
                  <th>Leave Type</th>
                  <th>Duration</th>
                  <th>Dates</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Annual Paid Leave</strong></td>
                  <td>2 Days</td>
                  <td>Aug 14, 2026 - Aug 15, 2026</td>
                  <td>Personal family event</td>
                  <td><Badge variant="success">Approved</Badge></td>
                </tr>
                <tr>
                  <td><strong>Casual Leave</strong></td>
                  <td>1 Day</td>
                  <td>Jul 02, 2026</td>
                  <td>Medical appointment</td>
                  <td><Badge variant="success">Approved</Badge></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  const renderPerformanceSection = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <h3 className={styles.sectionTitle}>Performance & KPI Scorecard</h3>
            <p className={styles.sectionDesc}>Project delivery metrics, task resolution velocity, and management ratings.</p>
          </div>
        </div>

        <div className={styles.statsStrip} style={{ borderTop: 'none', paddingTop: 0 }}>
          <div className={styles.statTile}>
            <div className={styles.statIconWrapper} style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent-dark)' }}>
              <FiAward />
            </div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>4.9 / 5.0</span>
              <span className={styles.statLabel}>Overall Rating</span>
            </div>
          </div>

          <div className={styles.statTile}>
            <div className={styles.statIconWrapper} style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
              <FiCheckCircle />
            </div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>96%</span>
              <span className={styles.statLabel}>On-Time Delivery</span>
            </div>
          </div>

          <div className={styles.statTile}>
            <div className={styles.statIconWrapper}>
              <FiFolder />
            </div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>{projects.length}</span>
              <span className={styles.statLabel}>Projects Delivered</span>
            </div>
          </div>

          <div className={styles.statTile}>
            <div className={styles.statIconWrapper}>
              <FiZap />
            </div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>Top 5%</span>
              <span className={styles.statLabel}>Efficiency Index</span>
            </div>
          </div>
        </div>

        <div className={styles.infoCard}>
          <div className={styles.infoCardHeader}>
            <span className={styles.infoCardIcon}><FiAward /></span>
            <h4 className={styles.infoCardTitle}>Quarterly Evaluation Summary</h4>
          </div>
          <div style={{ fontSize: 'var(--text-base)', lineHeight: 1.6, color: 'var(--color-text)' }}>
            <p>
              <strong>Performance Assessment:</strong> Demonstrates outstanding precision in interior design CAD layouts, client presentation deck preparations, and project milestone turnarounds.
            </p>
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Badge variant="accent">3D Visualization</Badge>
              <Badge variant="accent">Client Communication</Badge>
              <Badge variant="accent">Resource Efficiency</Badge>
              <Badge variant="success">Punctual Milestone Turnarounds</Badge>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderActiveTabContent = () => {
    switch (activeSection) {
      case 'overview': return renderOverviewSection()
      case 'timeline': return renderTimelineSection()
      case 'projects': return renderProjectsSection()
      case 'tasks': return renderTasksSection()
      case 'permissions': return renderPermissionsSection()
      case 'login-history': return renderLoginHistorySection()
      case 'devices': return renderDevicesSection()
      case 'audit-logs': return renderAuditLogsSection()
      case 'notes': return renderInternalNotesSection()
      case 'documents': return renderDocumentsSection()
      case 'attendance': return renderAttendanceSection()
      case 'performance': return renderPerformanceSection()
      default: return renderOverviewSection()
    }
  }

  const renderAccountSettingsModal = () => {
    if (!isAccountSettingsOpen) return null

    const statusOptions = [
      { value: 'active', label: 'Active (Full Access)' },
      { value: 'probation', label: 'Probation' },
      { value: 'pending_approval', label: 'Pending Approval' },
      { value: 'suspended', label: 'Suspended (Access Revoked)' },
      { value: 'inactive', label: 'Inactive / Archived' }
    ]

    return (
      <Modal
        isOpen={isAccountSettingsOpen}
        title="Employee Account Settings"
        onClose={() => setIsAccountSettingsOpen(false)}
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', padding: '4px 0' }}>
          <Input
            label="Official Email Address"
            type="email"
            value={accountForm.email}
            onChange={e => setAccountForm({ ...accountForm, email: e.target.value })}
            helperText="The user will use this address to log in to the CRM."
          />

          <Select
            label="System Role & Privilege Group"
            value={accountForm.role_id}
            options={roleOptions}
            onChange={val => setAccountForm({ ...accountForm, role_id: val })}
          />

          <Select
            label="Account Status"
            value={accountForm.status}
            options={statusOptions}
            onChange={val => setAccountForm({ ...accountForm, status: val })}
          />

          <Select
            label="Department"
            value={accountForm.department_id || ''}
            options={departmentOptions}
            onChange={val => setAccountForm({ ...accountForm, department_id: val })}
          />

          <Input
            label="Weekly Working Capacity (Hours)"
            type="number"
            min="0"
            max="168"
            value={accountForm.weekly_capacity}
            onChange={e => setAccountForm({ ...accountForm, weekly_capacity: e.target.value })}
          />

          <div style={{ position: 'relative' }}>
            <Input
              label="Reset User Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Leave empty to keep existing password"
              value={accountForm.password}
              onChange={e => setAccountForm({ ...accountForm, password: e.target.value })}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              }
              helperText="Set a temporary password to manually unlock or reset this account."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
            <Button variant="secondary" onClick={() => setIsAccountSettingsOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveAccountSettings}>
              Save Account Changes
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  const renderUploadDocModal = () => {
    if (!isUploadDocOpen) return null
    return (
      <Modal
        isOpen={isUploadDocOpen}
        title="Upload Employee Document"
        onClose={() => setIsUploadDocOpen(false)}
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input
            label="Document Title"
            placeholder="e.g. Identity Proof / Cert"
            value={newDocForm.title}
            onChange={e => setNewDocForm({ ...newDocForm, title: e.target.value })}
          />
          <Select
            label="Document Category"
            value={newDocForm.category}
            options={[
              { value: 'Identification', label: 'Identification (Passport/ID)' },
              { value: 'Agreement', label: 'Agreement & Contract' },
              { value: 'Academic', label: 'Academic & Certificate' },
              { value: 'Taxation', label: 'Taxation & Financial' },
              { value: 'Other', label: 'Other Attachment' }
            ]}
            onChange={val => setNewDocForm({ ...newDocForm, category: val })}
          />
          <div style={{ border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', textAlign: 'center', background: 'var(--color-bg)' }}>
            <FiUploadCloud style={{ fontSize: '32px', color: 'var(--color-accent)', marginBottom: '8px' }} />
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Choose a file to upload</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>PDF, PNG, JPG up to 10MB</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <Button variant="secondary" onClick={() => setIsUploadDocOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => {
              toast.success('Document uploaded successfully')
              setIsUploadDocOpen(false)
            }}>
              Upload Document
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  const userInitial = user.name ? user.name.charAt(0).toUpperCase() : '?'
  const userDept = departments.find(d => d.id === user.department_id)?.name || profile.department || 'Designer'

  return (
    <div className={styles.container}>
      
      {/* ── HERO HEADER CARD ── */}
      <div className={styles.heroCard}>
        <div className={styles.heroAccentLine} />
        
        <div className={styles.heroMainRow}>
          <div className={styles.heroIdentityGroup}>
            <div className={styles.avatarWrapper}>
              <div className={styles.heroAvatar}>
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.name} className={styles.avatarImg} />
                ) : (
                  userInitial
                )}
              </div>
              <div className={`${styles.statusIndicatorDot} ${getStatusDotClass(user.status)}`} title={`Status: ${user.status}`} />
            </div>

            <div className={styles.heroIdentityText}>
              <div className={styles.heroNameRow}>
                <h1 className={styles.heroName}>{user.name || 'Unnamed Employee'}</h1>
                <span className={styles.designationBadge}>{profile.designation || userDept}</span>
                <Badge variant={getStatusBadgeVariant(user.status)}>
                  {user.status?.toUpperCase() || 'ACTIVE'}
                </Badge>
              </div>

              <div className={styles.heroMetaRow}>
                <span
                  className={styles.copyableEmail}
                  onClick={() => handleCopy(user.email, 'email')}
                  title="Click to copy email address"
                >
                  <FiMail />
                  {user.email || 'No email provided'}
                  {copiedEmail ? <FiCheck style={{ color: 'var(--color-success)' }} /> : <FiCopy className={styles.copyIcon} />}
                </span>

                <span className={styles.metaDivider}>•</span>

                <span className={styles.metaItem}>
                  <FiShield /> {user.role_name || 'Designer'}
                </span>

                <span className={styles.metaDivider}>•</span>

                <span className={styles.metaItem}>
                  <FiBriefcase /> {userDept}
                </span>

                {profile.mobileNumber && (
                  <>
                    <span className={styles.metaDivider}>•</span>
                    <span
                      className={styles.copyableEmail}
                      onClick={() => handleCopy(profile.mobileNumber, 'phone')}
                      title="Click to copy phone number"
                    >
                      <FiPhone />
                      {profile.mobileNumber}
                      {copiedPhone ? <FiCheck style={{ color: 'var(--color-success)' }} /> : <FiCopy className={styles.copyIcon} />}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className={styles.heroActionsGroup}>
            <Button
              variant="secondary"
              onClick={() => onBack ? onBack() : navigate('/team/members')}
              icon={<FiArrowLeft />}
            >
              Back to Team
            </Button>

            {onConfigureMock && (
              <Button
                variant="secondary"
                onClick={() => onConfigureMock(user)}
                icon={<FiSliders />}
              >
                Configure Dev Login
              </Button>
            )}

            <Button
              variant="secondary"
              onClick={() => setIsAccountSettingsOpen(true)}
              icon={<FiSettings />}
            >
              Account Settings
            </Button>
          </div>
        </div>

        {/* Hero Bottom Metric Strip */}
        <div className={styles.statsStrip}>
          <div className={styles.statTile}>
            <div className={styles.statIconWrapper}>
              <FiFolder />
            </div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>{projects.length}</span>
              <span className={styles.statLabel}>Active Projects</span>
            </div>
          </div>

          <div className={styles.statTile}>
            <div className={styles.statIconWrapper}>
              <FiCheckSquare />
            </div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>{tasks.length}</span>
              <span className={styles.statLabel}>Assigned Tasks</span>
            </div>
          </div>

          <div className={styles.statTile}>
            <div className={styles.statIconWrapper}>
              <FiClock />
            </div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>
                {user.weekly_capacity !== undefined && user.weekly_capacity !== null ? user.weekly_capacity : 40} hrs
              </span>
              <span className={styles.statLabel}>Weekly Capacity</span>
            </div>
          </div>

          <div className={styles.statTile}>
            <div className={styles.statIconWrapper}>
              <FiCalendar />
            </div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>
                {user.created_at ? format(new Date(user.created_at), 'MMM yyyy') : '-'}
              </span>
              <span className={styles.statLabel}>Member Since</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN 2-COLUMN LAYOUT ── */}
      <div className={styles.layoutGrid}>
        
        {/* Left Navigation Sidebar */}
        <div className={styles.navSidebar}>
          {NAVIGATION_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className={styles.navGroup}>
              <div className={styles.navGroupTitle}>{group.category}</div>
              {group.items.map(item => {
                const isActive = activeSection === item.id
                let count = null
                if (item.countKey === 'projects') count = projects.length
                if (item.countKey === 'tasks') count = tasks.length
                if (item.countKey === 'devices') count = activeSessionsCount

                return (
                  <button
                    key={item.id}
                    className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                    onClick={() => setActiveSection(item.id)}
                  >
                    <div className={styles.navItemLeft}>
                      <span className={styles.navItemIcon}>{item.icon}</span>
                      <span className={styles.navItemLabel}>{item.label}</span>
                    </div>
                    {count !== null && (
                      <span className={styles.navCountBadge}>{count}</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Right Dynamic Tab Content */}
        <div className={styles.contentCard}>
          {renderActiveTabContent()}
        </div>

      </div>

      {/* Modals */}
      {renderAccountSettingsModal()}
      {renderUploadDocModal()}

    </div>
  )
}
