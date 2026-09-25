import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/authContext'
import api from '../../api/axios'
import { getLeaves, createLeave, deleteLeave } from '../../api/leaveApi'
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
  FiZap,
  FiTrash2
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
      { id: 'documents', label: 'Documents', icon: <FiFileText />, countKey: 'documents' },
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
  const { user: currentUser } = useAuth()
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
  const [tenantSettings, setTenantSettings] = useState(null)

  // Search & Filters inside tabs
  const [timelineFilter, setTimelineFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [taskFilter, setTaskFilter] = useState('all')
  const [auditSearch, setAuditSearch] = useState('')
  const [auditCategory, setAuditCategory] = useState('all')
  const [selectedAuditLog, setSelectedAuditLog] = useState(null)

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
    annual_leave_quota: '',
    password: ''
  })

  // Document Upload Modal state
  const [isUploadDocOpen, setIsUploadDocOpen] = useState(false)
  const [newDocForm, setNewDocForm] = useState({ title: '', category: 'Identification', file: null })

  // Leave Request Modal state
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false)
  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'Annual Paid Leave',
    start_date: '',
    end_date: '',
    duration: 1,
    reason: ''
  })

  const [leavesList, setLeavesList] = useState([])
  const [leavesLoading, setLeavesLoading] = useState(false)

  const fetchUserLeaves = async () => {
    if (!id) return
    try {
      setLeavesLoading(true)
      const leaves = await getLeaves({ userId: id })
      setLeavesList(Array.isArray(leaves) ? leaves : [])
    } catch (err) {
      console.error('Failed to fetch user leaves:', err)
    } finally {
      setLeavesLoading(false)
    }
  }

  useEffect(() => {
    fetchUserData()
    fetchMetadata()
    if (id) {
      fetchProjects()
      fetchTasks()
      fetchSessions()
      fetchLoginHistory()
      fetchUserLeaves()
    }
  }, [id])

  useEffect(() => {
    if (!user) return
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
      const rawProfile = typeof userData.profile_data === 'string'
        ? JSON.parse(userData.profile_data || '{}')
        : (userData.profile_data || {})

      setAccountForm({
        email: userData.email || '',
        role_id: userData.role_id || userData.role || '',
        status: userData.status || 'active',
        department_id: userData.department_id || '',
        weekly_capacity: userData.weekly_capacity !== undefined && userData.weekly_capacity !== null ? userData.weekly_capacity : 40,
        annual_leave_quota: rawProfile.annualLeaveQuota !== undefined && rawProfile.annualLeaveQuota !== null ? rawProfile.annualLeaveQuota : '',
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
      const [rolesRes, deptRes, tenantRes] = await Promise.allSettled([
        api.get('/roles'),
        api.get('/org/departments'),
        api.get('/config/tenant-settings')
      ])
      if (rolesRes.status === 'fulfilled') setRoles(rolesRes.value.data.data || [])
      if (deptRes.status === 'fulfilled') setDepartments(deptRes.value.data.data || [])
      if (tenantRes.status === 'fulfilled') setTenantSettings(tenantRes.value.data?.data || {})
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

  const handleUploadDocument = async () => {
    if (!newDocForm.title || !newDocForm.title.trim()) {
      toast.error('Please enter a document title')
      return
    }

    try {
      const currentProfileData = user?.profile_data || {}
      const currentDocs = Array.isArray(currentProfileData.documents) ? currentProfileData.documents : []
      
      const newDoc = {
        id: 'doc_' + Date.now(),
        title: newDocForm.title.trim(),
        type: newDocForm.category || 'Identification',
        status: 'verified',
        updated: new Date().toISOString(),
        file_name: newDocForm.file ? newDocForm.file.name : `${newDocForm.title.trim().toLowerCase().replace(/\s+/g, '_')}.pdf`
      }

      const updatedDocs = [newDoc, ...currentDocs]
      const updatedProfileData = { ...currentProfileData, documents: updatedDocs }

      const payload = {
        name: user.name,
        profile_data: updatedProfileData
      }

      const res = await api.patch(`/users/${id}`, payload)
      const updatedUser = res.data.data || { ...user, profile_data: updatedProfileData }
      setUser(updatedUser)
      setEditForm(JSON.parse(JSON.stringify(updatedUser)))
      setIsUploadDocOpen(false)
      setNewDocForm({ title: '', category: 'Identification', file: null })
      toast.success('Document uploaded and saved successfully')
    } catch (err) {
      console.error(err)
      toast.error('Failed to save document')
    }
  }

  const handleDeleteDocument = async (docId, docTitle) => {
    if (!await confirm(`Are you sure you want to remove "${docTitle}"?`)) return
    try {
      const currentProfileData = user?.profile_data || {}
      const currentDocs = Array.isArray(currentProfileData.documents) ? currentProfileData.documents : []
      const updatedDocs = currentDocs.filter(d => d.id !== docId)
      const updatedProfileData = { ...currentProfileData, documents: updatedDocs }

      const payload = {
        name: user.name,
        profile_data: updatedProfileData
      }

      const res = await api.patch(`/users/${id}`, payload)
      const updatedUser = res.data.data || { ...user, profile_data: updatedProfileData }
      setUser(updatedUser)
      setEditForm(JSON.parse(JSON.stringify(updatedUser)))
      toast.success('Document removed successfully')
    } catch (err) {
      console.error(err)
      toast.error('Failed to remove document')
    }
  }

  const handleRecordLeave = async () => {
    if (!leaveForm.start_date) {
      toast.error('Please select a leave date')
      return
    }

    try {
      const sDate = leaveForm.start_date
      const eDate = leaveForm.end_date || leaveForm.start_date

      await createLeave({
        userId: id,
        startDate: sDate,
        endDate: eDate,
        leaveType: leaveForm.leave_type || 'Annual Paid Leave',
        reason: leaveForm.reason?.trim() || 'Recorded by Admin',
        status: 'approved'
      })

      toast.success('Leave record saved and approved successfully')
      setIsLeaveModalOpen(false)
      setLeaveForm({
        leave_type: 'Annual Paid Leave',
        start_date: '',
        end_date: '',
        duration: 1,
        reason: ''
      })
      fetchUserLeaves()
    } catch (err) {
      console.error(err)
      toast.error(err?.response?.data?.message || 'Failed to record leave')
    }
  }

  const handleDeleteLeave = async (leaveId) => {
    if (!await confirm('Are you sure you want to remove this leave record?')) return
    try {
      if (typeof leaveId === 'string' && leaveId.startsWith('leave_')) {
        // Legacy fallback for old records in profile_data.leaves
        const currentProfileData = user?.profile_data || {}
        const currentLeaves = Array.isArray(currentProfileData.leaves) ? currentProfileData.leaves : []
        const updatedLeaves = currentLeaves.filter(l => l.id !== leaveId)
        const updatedProfileData = { ...currentProfileData, leaves: updatedLeaves }
        const payload = {
          name: user.name,
          profile_data: updatedProfileData
        }
        const res = await api.patch(`/users/${id}`, payload)
        const updatedUser = res.data.data || { ...user, profile_data: updatedProfileData }
        setUser(updatedUser)
        setEditForm(JSON.parse(JSON.stringify(updatedUser)))
      } else {
        // Relational database delete via deleteLeave
        await deleteLeave(leaveId, { cancellationReason: 'Removed by Admin from Profile' })
      }
      toast.success('Leave record removed successfully')
      fetchUserLeaves()
    } catch (err) {
      console.error(err)
      toast.error(err?.response?.data?.message || 'Failed to delete leave record')
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

      const currentProfileData = (typeof user?.profile_data === 'string' ? JSON.parse(user.profile_data || '{}') : user?.profile_data) || {}
      const updatedProfileData = {
        ...currentProfileData,
        annualLeaveQuota: accountForm.annual_leave_quota !== '' && accountForm.annual_leave_quota !== undefined && accountForm.annual_leave_quota !== null
          ? Number(accountForm.annual_leave_quota)
          : undefined
      }

      const patchData = {
        email: accountForm.email,
        role_id: accountForm.role_id,
        role_name: roleName,
        role: accountForm.role_id,
        status: accountForm.status,
        department_id: accountForm.department_id || null,
        weekly_capacity: accountForm.weekly_capacity ? Number(accountForm.weekly_capacity) : 40,
        profile_data: updatedProfileData
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
    if (roles.length > 0) {
      return roles.map(r => ({ value: r.id, label: r.name }))
    }
    return [
      { value: 'superadmin', label: 'Super Admin' },
      { value: 'pm', label: 'Project Manager' },
      { value: 'designer', label: 'Designer' }
    ]
  }, [roles])

  const departmentOptions = useMemo(() => {
    return [
      { value: '', label: 'None / General' },
      ...departments.map(d => ({ value: d.id, label: d.name }))
    ]
  }, [departments])

  const profile = (typeof user?.profile_data === 'string' ? JSON.parse(user.profile_data || '{}') : user?.profile_data) || {}
  const formProfile = (typeof editForm?.profile_data === 'string' ? JSON.parse(editForm.profile_data || '{}') : editForm?.profile_data) || {}

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
                label="Annual Leave Quota (Days / Year)"
                type="number"
                min="0"
                max="365"
                placeholder={`Company Default (${tenantSettings?.leave_policy?.default_annual_quota || 18} Days)`}
                value={formProfile.annualLeaveQuota !== undefined && formProfile.annualLeaveQuota !== null ? formProfile.annualLeaveQuota : ''}
                onChange={e => setEditForm({
                  ...editForm,
                  profile_data: {
                    ...formProfile,
                    annualLeaveQuota: e.target.value === '' ? '' : Number(e.target.value)
                  }
                })}
                helperText={`Leave blank to inherit company policy (${tenantSettings?.leave_policy?.default_annual_quota || 18} days/yr).`}
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
                  <Badge variant="info">{user.role_name || 'Team Member'}</Badge>
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
              <div className={styles.infoFieldRow}>
                <span className={styles.infoFieldLabel}>Annual Leave Quota</span>
                <span className={styles.infoFieldValue}>
                  {profile.annualLeaveQuota !== undefined && profile.annualLeaveQuota !== '' && profile.annualLeaveQuota !== null ? (
                    <span><strong>{profile.annualLeaveQuota} Days</strong> / year <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>(Individual Quota)</span></span>
                  ) : (
                    <span><strong>{tenantSettings?.leave_policy?.default_annual_quota || 18} Days</strong> / year <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>(Company Default)</span></span>
                  )}
                </span>
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
                <span className={styles.infoFieldValue}>{profile.workLocation || (currentUser?.tenant?.name ? `${currentUser.tenant.name} (HQ)` : 'Headquarters')}</span>
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
                      <div
                        className={styles.projectLink}
                        onClick={() => navigate(`/projects/${p.id}`)}
                      >
                        {p.name}
                      </div>
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
              const isActive = !s.expires_at || new Date(s.expires_at) > new Date()
              const ua = s.user_agent || ''
              const isMobile = ua.toLowerCase().includes('mobile') || ua.toLowerCase().includes('android') || ua.toLowerCase().includes('iphone')
              const isTablet = ua.toLowerCase().includes('ipad') || ua.toLowerCase().includes('tablet')
              
              let browserName = 'Web Browser'
              if (ua.includes('Edg') || ua.includes('Edge')) browserName = 'Microsoft Edge'
              else if (ua.includes('Chrome')) browserName = 'Google Chrome'
              else if (ua.includes('Firefox')) browserName = 'Mozilla Firefox'
              else if (ua.includes('Safari') && !ua.includes('Chrome')) browserName = 'Apple Safari'

              return (
                <div key={s.id} className={styles.deviceCard}>
                  <div className={styles.deviceHeader}>
                    <div className={styles.deviceInfoGroup}>
                      <div className={styles.deviceIconBox}>
                        {isMobile ? <FiSmartphone /> : isTablet ? <FiSmartphone /> : <FiMonitor />}
                      </div>
                      <div>
                        <div className={styles.deviceName}>{browserName}</div>
                        <div className={styles.deviceSubText}>IP: <code>{s.ip_address || '127.0.0.1'}</code></div>
                      </div>
                    </div>
                    <Badge variant={isActive ? 'success' : 'neutral'}>
                      {isActive ? 'Active Session' : 'Expired'}
                    </Badge>
                  </div>

                  <div className={styles.deviceMetaList}>
                    <div>
                      <strong>Created At:</strong> {s.created_at && !isNaN(new Date(s.created_at).getTime()) ? format(new Date(s.created_at), 'PP p') : '-'}
                    </div>
                    <div>
                      <strong>Last Active:</strong> {s.last_active_at && !isNaN(new Date(s.last_active_at).getTime()) ? format(new Date(s.last_active_at), 'PP p') : 'Just now'}
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

  // ── AUDIT LOG HELPER CONSTANTS & FUNCTIONS (NON-TECHNICAL) ──
  const ACTION_MAP = {
    'user.login': { label: 'System Login', category: 'Security & Access', categoryKey: 'security', variant: 'success', icon: <FiShield /> },
    'user.logout': { label: 'System Logout', category: 'Security & Access', categoryKey: 'security', variant: 'neutral', icon: <FiClock /> },
    'user.profile_updated': { label: 'Updated Profile Details', category: 'Profile & Account', categoryKey: 'account', variant: 'accent', icon: <FiUser /> },
    'user.update': { label: 'Account Information Updated', category: 'Profile & Account', categoryKey: 'account', variant: 'accent', icon: <FiUser /> },
    'user.status_changed': { label: 'Account Status Changed', category: 'Profile & Account', categoryKey: 'account', variant: 'warning', icon: <FiSliders /> },
    'user.role_changed': { label: 'Role & Permissions Updated', category: 'Security & Access', categoryKey: 'security', variant: 'warning', icon: <FiShield /> },
    'user.password_changed': { label: 'Password Reset', category: 'Security & Access', categoryKey: 'security', variant: 'warning', icon: <FiShield /> },
    'user.created': { label: 'Employee Account Created', category: 'Profile & Account', categoryKey: 'account', variant: 'success', icon: <FiUser /> },
    'project.created': { label: 'Created New Project', category: 'Projects', categoryKey: 'projects', variant: 'success', icon: <FiFolder /> },
    'project.updated': { label: 'Updated Project Details', category: 'Projects', categoryKey: 'projects', variant: 'accent', icon: <FiFolder /> },
    'project.status_changed': { label: 'Changed Project Status', category: 'Projects', categoryKey: 'projects', variant: 'warning', icon: <FiFolder /> },
    'project.phase_completed': { label: 'Completed Project Phase', category: 'Projects', categoryKey: 'projects', variant: 'success', icon: <FiCheckCircle /> },
    'project.archived': { label: 'Archived Project', category: 'Projects', categoryKey: 'projects', variant: 'danger', icon: <FiFolder /> },
    'project.reopened': { label: 'Reopened Project', category: 'Projects', categoryKey: 'projects', variant: 'info', icon: <FiFolder /> },
    'project.paused': { label: 'Paused Project', category: 'Projects', categoryKey: 'projects', variant: 'warning', icon: <FiFolder /> },
    'task.created': { label: 'Created New Task', category: 'Tasks', categoryKey: 'tasks', variant: 'success', icon: <FiCheckSquare /> },
    'task.bulk_created': { label: 'Created Multiple Tasks', category: 'Tasks', categoryKey: 'tasks', variant: 'success', icon: <FiCheckSquare /> },
    'task.status_changed': { label: 'Updated Task Status', category: 'Tasks', categoryKey: 'tasks', variant: 'accent', icon: <FiCheckSquare /> },
    'task.assigned': { label: 'Assigned Task to Member', category: 'Tasks', categoryKey: 'tasks', variant: 'info', icon: <FiCheckSquare /> },
    'task.completed': { label: 'Marked Task as Done', category: 'Tasks', categoryKey: 'tasks', variant: 'success', icon: <FiCheckCircle /> },
    'task.updated': { label: 'Updated Task Details', category: 'Tasks', categoryKey: 'tasks', variant: 'accent', icon: <FiCheckSquare /> },
    'lead.created': { label: 'Added New Client Inquiry', category: 'Sales & Clients', categoryKey: 'sales', variant: 'success', icon: <FiZap /> },
    'lead.updated': { label: 'Updated Client Details', category: 'Sales & Clients', categoryKey: 'sales', variant: 'accent', icon: <FiZap /> },
    'lead.stage_updated': { label: 'Moved Sales Pipeline Stage', category: 'Sales & Clients', categoryKey: 'sales', variant: 'accent', icon: <FiZap /> },
    'lead.status_changed': { label: 'Changed Inquiry Status', category: 'Sales & Clients', categoryKey: 'sales', variant: 'warning', icon: <FiZap /> },
    'lead.deleted': { label: 'Removed Client Inquiry', category: 'Sales & Clients', categoryKey: 'sales', variant: 'danger', icon: <FiZap /> },
    'payment.milestone_approved': { label: 'Approved Payment Milestone', category: 'Finance', categoryKey: 'finance', variant: 'success', icon: <FiAward /> },
    'payment.recorded': { label: 'Recorded Client Payment', category: 'Finance', categoryKey: 'finance', variant: 'success', icon: <FiAward /> },
    'invoice.generated': { label: 'Generated Project Invoice', category: 'Finance', categoryKey: 'finance', variant: 'info', icon: <FiFileText /> },
    'document.uploaded': { label: 'Uploaded Document', category: 'Documents', categoryKey: 'account', variant: 'info', icon: <FiUploadCloud /> }
  }

  const ENTITY_MAP = {
    user: 'Employee Account',
    project: 'Project Workspace',
    task: 'Task Item',
    lead: 'Client Inquiry',
    payment: 'Payment Record',
    payment_milestone: 'Payment Milestone',
    invoice: 'Client Invoice',
    document: 'Uploaded Document',
    role: 'Permissions & Access',
    tenant: 'Company Workspace'
  }

  const FIELD_LABELS = {
    name: 'Full Name',
    email: 'Email Address',
    role: 'Role / Access Level',
    role_id: 'Role / Access Level',
    role_name: 'Role Name',
    status: 'Account Status',
    status_reason: 'Status Reason',
    department_id: 'Department',
    weekly_capacity: 'Weekly Capacity (Hours)',
    stage: 'Sales Pipeline Stage',
    title: 'Title',
    priority: 'Priority Level',
    assigned_to: 'Assigned Team Member',
    amount: 'Payment Amount',
    due_date: 'Due Date',
    description: 'Description',
    avatar_url: 'Profile Picture',
    phone: 'Phone Number',
    phone_number: 'Phone Number',
    designation: 'Designation / Job Title'
  }

  const parseSafe = (val) => {
    if (!val) return null
    if (typeof val === 'object') return val
    try {
      return JSON.parse(val)
    } catch {
      return null
    }
  }

  const formatFieldValue = (val) => {
    if (val === null || val === undefined || val === '') return 'None'
    if (typeof val === 'boolean') return val ? 'Yes' : 'No'
    if (typeof val === 'object') {
      if (val.name) return String(val.name)
      if (val.title) return String(val.title)
      if (val.label) return String(val.label)
      return JSON.stringify(val)
    }
    return String(val)
  }

  const getAuditActionInfo = (rawAction = '') => {
    if (ACTION_MAP[rawAction]) return ACTION_MAP[rawAction]
    const parts = rawAction.split('.')
    const modulePart = parts[0] || 'System'
    const actionPart = parts.slice(1).join(' ') || modulePart
    const label = actionPart.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const category = ENTITY_MAP[modulePart] || (modulePart.charAt(0).toUpperCase() + modulePart.slice(1))
    let categoryKey = 'account'
    if (modulePart.includes('proj')) categoryKey = 'projects'
    else if (modulePart.includes('task')) categoryKey = 'tasks'
    else if (modulePart.includes('lead')) categoryKey = 'sales'
    else if (modulePart.includes('pay') || modulePart.includes('inv')) categoryKey = 'finance'
    else if (modulePart.includes('auth') || modulePart.includes('login') || modulePart.includes('pass') || modulePart.includes('role')) categoryKey = 'security'

    return {
      label,
      category,
      categoryKey,
      variant: 'accent',
      icon: <FiActivity />
    }
  }

  const getAuditSummary = (log) => {
    const action = log.action || ''
    if (action === 'user.login') return 'Signed in to the portal successfully'
    if (action === 'user.logout') return 'Signed out of session'
    
    const oldVal = parseSafe(log.old_value)
    const newVal = parseSafe(log.new_value)

    if (oldVal && newVal && typeof oldVal === 'object' && typeof newVal === 'object') {
      const changedKeys = Object.keys(newVal).filter(k => 
        oldVal[k] !== undefined && 
        JSON.stringify(oldVal[k]) !== JSON.stringify(newVal[k]) &&
        !['updated_at', 'id', 'user_id', 'tenant_id', 'created_at', 'password_hash'].includes(k)
      )

      if (changedKeys.length === 1) {
        const field = FIELD_LABELS[changedKeys[0]] || changedKeys[0].replace(/_/g, ' ')
        const fromStr = formatFieldValue(oldVal[changedKeys[0]])
        const toStr = formatFieldValue(newVal[changedKeys[0]])
        return `Changed ${field} from "${fromStr}" to "${toStr}"`
      }
      if (changedKeys.length > 1) {
        const fieldNames = changedKeys.slice(0, 3).map(k => FIELD_LABELS[k] || k.replace(/_/g, ' ')).join(', ')
        const remaining = changedKeys.length - 3
        return `Updated ${changedKeys.length} settings (${fieldNames}${remaining > 0 ? ` +${remaining} more` : ''})`
      }
    }

    if (newVal && typeof newVal === 'object') {
      const titleOrName = newVal.name || newVal.title || newVal.stage || newVal.status
      if (titleOrName) return `Updated record: "${titleOrName}"`
    }

    return 'Activity recorded in workspace'
  }

  const getDeviceDisplay = (log) => {
    if (log.browser) {
      const dev = log.device ? ` · ${log.device}` : ''
      return `${log.browser}${dev}`
    }
    const ua = log.user_agent || ''
    if (ua.includes('Edg') || ua.includes('Edge')) return 'Microsoft Edge'
    if (ua.includes('Chrome')) return 'Google Chrome'
    if (ua.includes('Firefox')) return 'Mozilla Firefox'
    if (ua.includes('Safari')) return 'Apple Safari'
    return 'Desktop Browser'
  }

  const getActorDisplay = (log) => {
    if (log.user_id === id) return 'This Employee (Self)'
    if (log.actor_name) return log.actor_name
    return 'System Administrator'
  }

  const getEntityDisplay = (log) => {
    const entityType = ENTITY_MAP[log.entity] || (log.entity ? log.entity.charAt(0).toUpperCase() + log.entity.slice(1) : 'General')
    const newVal = parseSafe(log.new_value)
    const oldVal = parseSafe(log.old_value)
    const recordName = newVal?.name || newVal?.title || newVal?.project_name || oldVal?.name || oldVal?.title
    return {
      type: entityType,
      name: recordName || null
    }
  }

  // ── AUDIT LOG NARRATIVE FORMATTER (CLEAR PLAIN ENGLISH: WHAT HAPPENED & WHEN) ──
  const describeAuditEvent = (log, employeeName) => {
    const action = (log.action || '').toLowerCase()
    const actor = log.user_id === id 
      ? (employeeName || 'This team member') 
      : (log.actor_name || 'Administrator')

    const oldVal = parseSafe(log.old_value) || {}
    const newVal = parseSafe(log.new_value) || {}
    const device = getDeviceDisplay(log)

    const timePrimary = log.created_at && !isNaN(new Date(log.created_at).getTime())
      ? format(new Date(log.created_at), 'PPP · p')
      : 'Recently'
    const timeRelative = log.created_at && !isNaN(new Date(log.created_at).getTime())
      ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true })
      : ''

    let whatHappened = ''
    let narrative = ''
    let categoryLabel = 'Activity'
    let categoryKey = 'account'
    let icon = <FiActivity />
    let iconBg = 'rgba(59, 130, 246, 0.1)'
    let iconColor = 'var(--color-accent)'
    let badgeVariant = 'accent'

    // 1. Logins & Logouts
    if (action.includes('login')) {
      whatHappened = `${actor} logged into the system`
      narrative = `Signed in securely from ${device}.`
      categoryLabel = 'Login'
      categoryKey = 'security'
      icon = <FiShield />
      iconBg = 'rgba(34, 197, 94, 0.1)'
      iconColor = 'var(--color-success)'
      badgeVariant = 'success'
    } else if (action.includes('logout')) {
      whatHappened = `${actor} logged out of the system`
      narrative = `Closed session from ${device}.`
      categoryLabel = 'Logout'
      categoryKey = 'security'
      icon = <FiClock />
      iconBg = 'rgba(100, 116, 139, 0.1)'
      iconColor = 'var(--color-text-muted)'
      badgeVariant = 'neutral'
    }
    // 2. Account Status
    else if (action.includes('status')) {
      const oldStatus = oldVal.status || oldVal.old_status || 'Previous'
      const newStatus = newVal.status || newVal.new_status || 'Updated'
      whatHappened = `Account status changed to ${newStatus}`
      narrative = `${actor} updated the account status from "${oldStatus}" to "${newStatus}".`
      categoryLabel = 'Account Status'
      categoryKey = 'account'
      icon = <FiSliders />
      iconBg = 'rgba(234, 179, 8, 0.1)'
      iconColor = 'var(--color-warning)'
      badgeVariant = 'warning'
    }
    // 3. Role / Permissions
    else if (action.includes('role') || action.includes('permission')) {
      const roleName = newVal.role || newVal.role_name || 'Updated Role'
      whatHappened = `Job role updated to ${roleName}`
      narrative = `${actor} updated permissions and assigned the role "${roleName}".`
      categoryLabel = 'Role & Permissions'
      categoryKey = 'security'
      icon = <FiShield />
      iconBg = 'rgba(234, 179, 8, 0.1)'
      iconColor = 'var(--color-warning)'
      badgeVariant = 'warning'
    }
    // 4. Password
    else if (action.includes('password')) {
      whatHappened = `Account password was reset`
      narrative = `${actor} updated the account login password.`
      categoryLabel = 'Password Reset'
      categoryKey = 'security'
      icon = <FiShield />
      iconBg = 'rgba(239, 68, 68, 0.1)'
      iconColor = 'var(--color-danger)'
      badgeVariant = 'danger'
    }
    // 5. Profile Updates
    else if (action.includes('profile') || action.includes('user.update') || action.includes('user_updated')) {
      whatHappened = `${actor} updated profile details`
      if (newVal.weekly_capacity !== undefined && oldVal.weekly_capacity !== undefined && newVal.weekly_capacity !== oldVal.weekly_capacity) {
        narrative = `Working capacity changed from ${oldVal.weekly_capacity} hrs to ${newVal.weekly_capacity} hrs per week.`
      } else {
        narrative = `Profile information and contact settings were updated.`
      }
      categoryLabel = 'Profile Update'
      categoryKey = 'account'
      icon = <FiUser />
      iconBg = 'rgba(59, 130, 246, 0.1)'
      iconColor = 'var(--color-accent)'
      badgeVariant = 'accent'
    }
    // 6. Projects
    else if (action.startsWith('project.')) {
      const projectName = newVal.name || newVal.title || oldVal.name || 'Interior Project'
      categoryLabel = 'Project'
      categoryKey = 'projects'
      icon = <FiFolder />
      iconBg = 'rgba(59, 130, 246, 0.1)'
      iconColor = 'var(--color-accent)'

      if (action.includes('created')) {
        whatHappened = `${actor} created project "${projectName}"`
        narrative = `Started a new project workspace.`
        badgeVariant = 'success'
      } else if (action.includes('status') || action.includes('stage')) {
        const stage = newVal.status || newVal.stage || 'Updated Stage'
        whatHappened = `Project "${projectName}" moved to ${stage}`
        narrative = `${actor} updated the project progress stage.`
        badgeVariant = 'accent'
      } else if (action.includes('archived')) {
        whatHappened = `Project "${projectName}" was archived`
        narrative = `${actor} archived this project.`
        badgeVariant = 'danger'
      } else if (action.includes('phase')) {
        whatHappened = `Completed milestone in "${projectName}"`
        narrative = `${actor} marked a project phase as completed.`
        badgeVariant = 'success'
      } else {
        whatHappened = `${actor} updated project "${projectName}"`
        narrative = `Project milestones and details were updated.`
        badgeVariant = 'accent'
      }
    }
    // 7. Tasks
    else if (action.startsWith('task.')) {
      const taskTitle = newVal.title || newVal.name || oldVal.title || 'Task'
      categoryLabel = 'Task'
      categoryKey = 'tasks'
      icon = <FiCheckSquare />
      iconBg = 'rgba(168, 85, 247, 0.1)'
      iconColor = '#a855f7'

      if (action.includes('created')) {
        whatHappened = `${actor} created task "${taskTitle}"`
        narrative = `A new assignment was added to the task queue.`
        badgeVariant = 'success'
      } else if (action.includes('status') || action.includes('completed')) {
        const st = newVal.status || 'Completed'
        whatHappened = `Task "${taskTitle}" marked as ${st}`
        narrative = `${actor} updated the task status.`
        badgeVariant = st.toLowerCase().includes('done') || st.toLowerCase().includes('complete') ? 'success' : 'accent'
      } else if (action.includes('assigned')) {
        whatHappened = `Task "${taskTitle}" was assigned`
        narrative = `${actor} assigned this task.`
        badgeVariant = 'info'
      } else {
        whatHappened = `${actor} updated task "${taskTitle}"`
        narrative = `Task details and instructions were updated.`
        badgeVariant = 'accent'
      }
    }
    // 8. Sales & Client Inquiries
    else if (action.startsWith('lead.')) {
      const leadName = newVal.name || newVal.client_name || oldVal.name || 'Client Lead'
      categoryLabel = 'Client Lead'
      categoryKey = 'sales'
      icon = <FiZap />
      iconBg = 'rgba(234, 179, 8, 0.1)'
      iconColor = 'var(--color-warning)'

      if (action.includes('created')) {
        whatHappened = `${actor} added client inquiry for "${leadName}"`
        narrative = `New client lead entered into the sales pipeline.`
        badgeVariant = 'success'
      } else if (action.includes('stage')) {
        const stage = newVal.stage || 'Next Stage'
        whatHappened = `Moved client "${leadName}" to stage "${stage}"`
        narrative = `${actor} advanced the client inquiry stage.`
        badgeVariant = 'accent'
      } else {
        whatHappened = `${actor} updated client inquiry for "${leadName}"`
        narrative = `Inquiry details and requirements were updated.`
        badgeVariant = 'accent'
      }
    }
    // 9. Finance & Payments
    else if (action.includes('payment') || action.includes('invoice') || action.includes('milestone')) {
      categoryLabel = 'Finance'
      categoryKey = 'finance'
      icon = <FiAward />
      iconBg = 'rgba(34, 197, 94, 0.1)'
      iconColor = 'var(--color-success)'

      if (action.includes('approved')) {
        whatHappened = `${actor} approved payment milestone`
        narrative = `Client payment milestone was verified and approved.`
        badgeVariant = 'success'
      } else if (action.includes('invoice')) {
        whatHappened = `${actor} generated client invoice`
        narrative = `Project invoice was created.`
        badgeVariant = 'info'
      } else {
        whatHappened = `${actor} recorded payment`
        narrative = `Payment transaction recorded in project account.`
        badgeVariant = 'success'
      }
    }
    // 10. Documents
    else if (action.includes('document') || action.includes('upload')) {
      const docTitle = newVal.title || 'Document'
      whatHappened = `${actor} uploaded document "${docTitle}"`
      narrative = `File was uploaded and saved to employee records.`
      categoryLabel = 'Document'
      categoryKey = 'account'
      icon = <FiUploadCloud />
      iconBg = 'rgba(59, 130, 246, 0.1)'
      iconColor = 'var(--color-accent)'
      badgeVariant = 'info'
    }
    // 11. Legacy or Raw Workspace Actions (Safeguard against any technical terms like api.post, api.patch, etc.)
    else if (action.startsWith('api.') || action.includes('route') || log.entity === 'api_route') {
      const path = (newVal.path || '').toLowerCase()
      if (path.includes('/users') || path.includes('/profile') || path.includes('/team')) {
        whatHappened = `${actor} updated employee profile details`
        narrative = `Updated personal profile and workplace preferences.`
        categoryLabel = 'Profile Update'
        categoryKey = 'account'
        icon = <FiUser />
        iconBg = 'rgba(59, 130, 246, 0.1)'
        iconColor = 'var(--color-accent)'
        badgeVariant = 'accent'
      } else if (path.includes('/projects')) {
        whatHappened = `${actor} updated project records`
        narrative = `Saved changes to project details and milestones.`
        categoryLabel = 'Project'
        categoryKey = 'projects'
        icon = <FiFolder />
        iconBg = 'rgba(59, 130, 246, 0.1)'
        iconColor = 'var(--color-accent)'
        badgeVariant = 'accent'
      } else if (path.includes('/tasks')) {
        whatHappened = `${actor} updated task item`
        narrative = `Updated task progress and assignment details.`
        categoryLabel = 'Task'
        categoryKey = 'tasks'
        icon = <FiCheckSquare />
        iconBg = 'rgba(168, 85, 247, 0.1)'
        iconColor = '#a855f7'
        badgeVariant = 'accent'
      } else if (path.includes('/leads')) {
        whatHappened = `${actor} updated client inquiry`
        narrative = `Modified client contact and opportunity information.`
        categoryLabel = 'Client Lead'
        categoryKey = 'sales'
        icon = <FiZap />
        iconBg = 'rgba(234, 179, 8, 0.1)'
        iconColor = 'var(--color-warning)'
        badgeVariant = 'accent'
      } else {
        whatHappened = `${actor} updated workspace records`
        narrative = `Changes saved successfully to workspace records.`
        categoryLabel = 'Workspace'
        categoryKey = 'account'
        icon = <FiActivity />
        iconBg = 'rgba(59, 130, 246, 0.1)'
        iconColor = 'var(--color-accent)'
        badgeVariant = 'neutral'
      }
    }
    // Fallback: strictly non-technical plain English
    else {
      let cleanAction = action
        .replace(/^(user\.|employee\.|project\.|task\.|lead\.|org\.|record\.)/, '')
        .replace(/^(api\.)/i, '')
        .replace(/[_-]/g, ' ')
        .trim()

      if (cleanAction.toLowerCase() === 'post') cleanAction = 'created new record'
      else if (cleanAction.toLowerCase() === 'patch' || cleanAction.toLowerCase() === 'put') cleanAction = 'updated details'
      else if (cleanAction.toLowerCase() === 'delete') cleanAction = 'removed record'
      else if (!cleanAction) cleanAction = 'updated records'
      else cleanAction = cleanAction.replace(/\b\w/g, c => c.toUpperCase())

      whatHappened = `${actor}: ${cleanAction}`
      narrative = `Activity completed in the team workspace.`
      categoryLabel = 'Activity'
      categoryKey = 'account'
      icon = <FiActivity />
      iconBg = 'rgba(59, 130, 246, 0.1)'
      iconColor = 'var(--color-accent)'
      badgeVariant = 'neutral'
    }

    return {
      whatHappened,
      narrative,
      categoryLabel,
      categoryKey,
      timePrimary,
      timeRelative,
      device,
      icon,
      iconBg,
      iconColor,
      badgeVariant
    }
  }

  const renderAuditLogsSection = () => {
    const totalActivities = auditLogs.length
    const securityActivities = auditLogs.filter(l => l.action?.startsWith('user.login') || l.action?.startsWith('user.logout') || l.action?.includes('password') || l.action?.includes('role')).length
    const workActivities = auditLogs.filter(l => l.action?.startsWith('project.') || l.action?.startsWith('task.') || l.action?.startsWith('lead.')).length
    const lastActivityText = auditLogs[0]?.created_at && !isNaN(new Date(auditLogs[0].created_at).getTime())
      ? formatDistanceToNow(new Date(auditLogs[0].created_at), { addSuffix: true })
      : 'None'

    const filteredLogs = auditLogs.filter(l => {
      const event = describeAuditEvent(l, user?.name)
      if (auditCategory !== 'all' && event.categoryKey !== auditCategory) {
        return false
      }
      if (!auditSearch) return true
      const q = auditSearch.toLowerCase()
      return (
        event.whatHappened.toLowerCase().includes(q) ||
        event.narrative.toLowerCase().includes(q) ||
        event.categoryLabel.toLowerCase().includes(q) ||
        event.device.toLowerCase().includes(q)
      )
    })

    const categories = [
      { id: 'all', label: 'All Activities', count: totalActivities },
      { id: 'security', label: 'Security & Logins', count: securityActivities },
      { id: 'projects', label: 'Projects', count: auditLogs.filter(l => l.action?.startsWith('project.')).length },
      { id: 'tasks', label: 'Tasks', count: auditLogs.filter(l => l.action?.startsWith('task.')).length },
      { id: 'sales', label: 'Sales & Clients', count: auditLogs.filter(l => l.action?.startsWith('lead.')).length },
      { id: 'account', label: 'Profile & Account', count: auditLogs.filter(l => l.action?.startsWith('user.') && !l.action?.includes('login') && !l.action?.includes('logout')).length }
    ]

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        
        {/* Section Header */}
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <h3 className={styles.sectionTitle}>Employee Activity & Audit History</h3>
            <p className={styles.sectionDesc}>
              Plain-language timeline showing what happened and exactly when it happened for this team member.
            </p>
          </div>
          <div style={{ width: '280px' }}>
            <Input
              placeholder="Search by activity, action, or date..."
              value={auditSearch}
              onChange={e => setAuditSearch(e.target.value)}
              leftIcon={<FiSearch />}
            />
          </div>
        </div>

        {/* Top Overview Cards */}
        <div className={styles.auditKpiGrid}>
          <div className={styles.auditKpiCard}>
            <div className={styles.auditKpiIconBox} style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-accent)' }}>
              <FiActivity />
            </div>
            <div>
              <div className={styles.auditKpiValue}>{totalActivities}</div>
              <div className={styles.auditKpiLabel}>Total Activities Logged</div>
            </div>
          </div>

          <div className={styles.auditKpiCard}>
            <div className={styles.auditKpiIconBox} style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-success)' }}>
              <FiShield />
            </div>
            <div>
              <div className={styles.auditKpiValue}>{securityActivities}</div>
              <div className={styles.auditKpiLabel}>Logins & Security Events</div>
            </div>
          </div>

          <div className={styles.auditKpiCard}>
            <div className={styles.auditKpiIconBox} style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
              <FiFolder />
            </div>
            <div>
              <div className={styles.auditKpiValue}>{workActivities}</div>
              <div className={styles.auditKpiLabel}>Project & Task Updates</div>
            </div>
          </div>

          <div className={styles.auditKpiCard}>
            <div className={styles.auditKpiIconBox} style={{ background: 'rgba(234, 179, 8, 0.1)', color: 'var(--color-warning)' }}>
              <FiClock />
            </div>
            <div>
              <div className={styles.auditKpiValue} style={{ fontSize: 'var(--text-base)' }}>{lastActivityText}</div>
              <div className={styles.auditKpiLabel}>Most Recent Activity</div>
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className={styles.auditFilterBar}>
          <div className={styles.auditCategoryPills}>
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                className={`${styles.auditPill} ${auditCategory === cat.id ? styles.auditPillActive : ''}`}
                onClick={() => setAuditCategory(cat.id)}
              >
                <span>{cat.label}</span>
                <span style={{ opacity: 0.8, fontSize: '11px' }}>({cat.count})</span>
              </button>
            ))}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchAuditLogs}
            icon={<FiClock />}
          >
            Refresh History
          </Button>
        </div>

        {/* Narrative Activity Feed: What Happened & When It Happened */}
        {filteredLogs.length === 0 ? (
          <div className={styles.emptyStateBox}>
            <FiClock className={styles.emptyStateIcon} />
            <h4 className={styles.emptyStateTitle}>No Activities Found</h4>
            <p className={styles.emptyStateDesc}>
              {auditSearch || auditCategory !== 'all' 
                ? 'No events match your current search or category filter.' 
                : 'No activities have been recorded for this team member yet.'}
            </p>
          </div>
        ) : (
          <div className={styles.auditFeedList}>
            {filteredLogs.map(l => {
              const event = describeAuditEvent(l, user?.name)
              const hasDiff = l.old_value && l.new_value

              return (
                <div key={l.id} className={styles.auditFeedCard}>
                  {/* Left: What happened */}
                  <div className={styles.auditFeedLeft}>
                    <div className={styles.auditFeedIconBox} style={{ background: event.iconBg, color: event.iconColor }}>
                      {event.icon}
                    </div>
                    <div className={styles.auditFeedMain}>
                      <div className={styles.auditFeedTitle}>{event.whatHappened}</div>
                      <div className={styles.auditFeedDescription}>{event.narrative}</div>
                      <div className={styles.auditFeedMeta}>
                        <Badge variant={event.badgeVariant}>{event.categoryLabel}</Badge>
                        <span>•</span>
                        <span>{event.device}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: When it happened */}
                  <div className={styles.auditFeedRight}>
                    <div className={styles.auditFeedTimePrimary}>{event.timePrimary}</div>
                    <div className={styles.auditFeedTimeRelative}>{event.timeRelative}</div>
                    {hasDiff && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedAuditLog(l)}
                        icon={<FiEye />}
                        style={{ marginTop: '4px', fontSize: '12px' }}
                      >
                        View Changes
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
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
    const userDocs = Array.isArray(profile.documents) ? profile.documents : []

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <h3 className={styles.sectionTitle}>Employee Documents & Compliance</h3>
            <p className={styles.sectionDesc}>Verification documents, identification proofs, and signed employment agreements.</p>
          </div>
          <Button
            variant="primary"
            onClick={() => setIsUploadDocOpen(true)}
            icon={<FiUploadCloud />}
          >
            Upload Document
          </Button>
        </div>

        {userDocs.length === 0 ? (
          <div className={styles.emptyStateBox}>
            <FiFileText className={styles.emptyStateIcon} />
            <h4 className={styles.emptyStateTitle}>No Documents Uploaded</h4>
            <p className={styles.emptyStateDesc}>
              No verification or employment documents have been uploaded for this team member yet.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsUploadDocOpen(true)}
              icon={<FiUploadCloud />}
              style={{ marginTop: 'var(--space-2)' }}
            >
              Upload First Document
            </Button>
          </div>
        ) : (
          <div className={styles.docGrid}>
            {userDocs.map(doc => (
              <div key={doc.id} className={styles.docCard}>
                <div className={styles.docCardTop}>
                  <div className={styles.docIconBox}>
                    <FiFileText />
                  </div>
                  <div className={styles.docDetails}>
                    <div className={styles.docTitle}>{doc.title}</div>
                    <div className={styles.docMeta}>Category: {doc.type}</div>
                    <div className={styles.docMeta}>
                      Updated: {doc.updated && !isNaN(new Date(doc.updated).getTime()) ? format(new Date(doc.updated), 'PP') : 'Recently'}
                    </div>
                  </div>
                </div>
                <div className={styles.docActions}>
                  <Badge variant={doc.status === 'verified' ? 'success' : 'warning'}>
                    {doc.status === 'verified' ? 'Verified' : 'Pending Review'}
                  </Badge>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <Button variant="ghost" size="sm" onClick={() => toast.success(`Viewing ${doc.title}`)}>
                      <FiDownload /> View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDocument(doc.id, doc.title)}
                      style={{ color: 'var(--color-danger)' }}
                      title="Delete document"
                    >
                      <FiTrash2 />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderAttendanceSection = () => {
    // Unify leaves: Real database user_leaves takes priority, merged with legacy profile leaves if any
    const legacyLeaves = Array.isArray(profile.leaves) ? profile.leaves : []
    const combinedLeaves = [
      ...leavesList,
      ...legacyLeaves.filter(leg => !leavesList.some(db => db.id === leg.id))
    ]
    
    const now = new Date()

    const getDays = (l) => {
      if (l.start_date && l.end_date) {
        const s = new Date(l.start_date)
        const e = new Date(l.end_date)
        const diffTime = Math.abs(e - s)
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
        return diffDays > 0 ? diffDays : 1
      }
      const parsed = parseInt(l.duration, 10)
      return isNaN(parsed) ? 1 : parsed
    }
    
    // Organization leave policy settings
    const leavePolicy = tenantSettings?.leave_policy || {}
    const defaultOrgQuota = leavePolicy.default_annual_quota !== undefined && leavePolicy.default_annual_quota !== ''
      ? Number(leavePolicy.default_annual_quota)
      : 18
    const workWeek = leavePolicy.work_week || '5_days'
    const fiscalYearStart = leavePolicy.fiscal_year_start || 'january'

    // Annual Quota: Individual employee profile override takes priority, otherwise falls back to company policy default
    const annualQuota = profile.annualLeaveQuota !== undefined && profile.annualLeaveQuota !== '' && profile.annualLeaveQuota !== null
      ? Number(profile.annualLeaveQuota)
      : defaultOrgQuota

    // Determine current leave cycle period (Calendar Year vs Fiscal Year starting April)
    const currentYear = now.getFullYear()
    let cycleStart, cycleEnd
    if (fiscalYearStart === 'april') {
      const startYear = now.getMonth() >= 3 ? currentYear : currentYear - 1
      cycleStart = new Date(startYear, 3, 1, 0, 0, 0) // April 1
      cycleEnd = new Date(startYear + 1, 2, 31, 23, 59, 59) // March 31
    } else {
      // Default: Calendar Year (Jan 1 - Dec 31)
      cycleStart = new Date(currentYear, 0, 1, 0, 0, 0)
      cycleEnd = new Date(currentYear, 11, 31, 23, 59, 59)
    }

    // Only APPROVED leaves within current annual cycle count towards quota deduction
    const approvedLeavesThisCycle = combinedLeaves.filter(l => {
      if ((l.status || '').toLowerCase() !== 'approved') return false
      const leaveDate = new Date(l.start_date || l.created_at)
      if (isNaN(leaveDate.getTime())) return true
      return leaveDate >= cycleStart && leaveDate <= cycleEnd
    })

    // Total days leaves taken in current cycle
    const totalLeavesTaken = approvedLeavesThisCycle.reduce((sum, l) => sum + getDays(l), 0)
    const availableBalance = Math.max(0, annualQuota - totalLeavesTaken)

    // Current month working days based on workWeek configuration (5 days: Mon-Fri vs 6 days: Mon-Sat)
    const currentMonthWorkingDays = (() => {
      let count = 0
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const curDay = new Date(startOfMonth)
      while (curDay <= now) {
        const dayOfWeek = curDay.getDay()
        const isOffDay = workWeek === '6_days' ? (dayOfWeek === 0) : (dayOfWeek === 0 || dayOfWeek === 6)
        if (!isOffDay) count++
        curDay.setDate(curDay.getDate() + 1)
      }
      return Math.max(0, count)
    })()

    // Current month approved leaves
    const currentMonthLeaves = combinedLeaves.filter(l => {
      if ((l.status || '').toLowerCase() !== 'approved') return false
      const dateToCheck = l.start_date || l.created_at
      if (!dateToCheck) return false
      const d = new Date(dateToCheck)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).reduce((sum, l) => sum + getDays(l), 0)

    const presentThisMonth = Math.max(0, currentMonthWorkingDays - currentMonthLeaves)
    const attendanceRate = currentMonthWorkingDays > 0 
      ? Math.round((presentThisMonth / currentMonthWorkingDays) * 100) 
      : 100

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <h3 className={styles.sectionTitle}>Attendance & Leave Records</h3>
            <p className={styles.sectionDesc}>
              Summary of monthly present days, annual leave balance ({fiscalYearStart === 'april' ? 'Fiscal Year: Apr–Mar' : 'Calendar Year: Jan–Dec'}, {workWeek === '6_days' ? '6-Day Work Week' : '5-Day Work Week'}), and synchronized leave requests.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setIsLeaveModalOpen(true)}
            icon={<FiCalendar />}
          >
            Record Leave
          </Button>
        </div>

        <div className={styles.statsStrip} style={{ borderTop: 'none', paddingTop: 0 }}>
          <div className={styles.statTile}>
            <div className={styles.statIconWrapper} style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
              <FiCheckCircle />
            </div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>{attendanceRate}%</span>
              <span className={styles.statLabel}>Attendance Rate</span>
            </div>
          </div>

          <div className={styles.statTile}>
            <div className={styles.statIconWrapper}>
              <FiCalendar />
            </div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>{presentThisMonth} {presentThisMonth === 1 ? 'Day' : 'Days'}</span>
              <span className={styles.statLabel}>Present This Month</span>
            </div>
          </div>

          <div className={styles.statTile}>
            <div className={styles.statIconWrapper} style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
              <FiClock />
            </div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>{totalLeavesTaken} {totalLeavesTaken === 1 ? 'Day' : 'Days'}</span>
              <span className={styles.statLabel}>Approved Leaves Taken</span>
            </div>
          </div>

          <div className={styles.statTile}>
            <div className={styles.statIconWrapper}>
              <FiAward />
            </div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>{availableBalance} / {annualQuota} Days</span>
              <span className={styles.statLabel}>Available Balance</span>
            </div>
          </div>
        </div>

        <div className={styles.infoCard}>
          <div className={styles.infoCardHeader}>
            <span className={styles.infoCardIcon}><FiCalendar /></span>
            <h4 className={styles.infoCardTitle}>Synchronized Leave Requests</h4>
          </div>

          {combinedLeaves.length === 0 ? (
            <div className={styles.emptyStateBox} style={{ border: 'none', padding: 'var(--space-8) var(--space-4)' }}>
              <FiCalendar className={styles.emptyStateIcon} />
              <h4 className={styles.emptyStateTitle}>No Leave Records Found</h4>
              <p className={styles.emptyStateDesc}>
                This team member has not taken or requested any leaves yet.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsLeaveModalOpen(true)}
                icon={<FiCalendar />}
                style={{ marginTop: 'var(--space-2)' }}
              >
                Record First Leave
              </Button>
            </div>
          ) : (
            <div className={styles.tableContainer} style={{ border: 'none' }}>
              <table className={styles.crmTable}>
                <thead>
                  <tr>
                    <th>Leave Type</th>
                    <th>Duration</th>
                    <th>Dates</th>
                    <th>Reason</th>
                    <th>Project Handover</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedLeaves.map(leave => {
                    const days = getDays(leave)
                    const statusStr = (leave.status || 'Approved').toLowerCase()
                    const badgeVariant = statusStr === 'approved' ? 'success' : (statusStr === 'planned' ? 'info' : 'danger')
                    const datesDisplay = leave.start_date && leave.end_date
                      ? `${format(new Date(leave.start_date), 'PP')} – ${format(new Date(leave.end_date), 'PP')}`
                      : (leave.dates || leave.start_date || '—')

                    return (
                      <tr key={leave.id}>
                        <td><strong>{leave.leave_type || leave.type || 'Annual Leave'}</strong></td>
                        <td>{days} {days === 1 ? 'Day' : 'Days'}</td>
                        <td>{datesDisplay}</td>
                        <td style={{ maxWidth: '200px' }}>{leave.reason || '—'}</td>
                        <td style={{ maxWidth: '220px', fontSize: '12px' }}>
                          {leave.coverages && leave.coverages.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {leave.coverages.map((cov, ci) => (
                                <span key={ci} style={{ color: 'var(--color-text-secondary)' }}>
                                  🤝 Covered by <strong>{cov.covering_user_name || 'Colleague'}</strong> on {cov.project_name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)' }}>None</span>
                          )}
                        </td>
                        <td>
                          <Badge variant={badgeVariant}>
                            {leave.status || 'Approved'}
                          </Badge>
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteLeave(leave.id)}
                            style={{ color: 'var(--color-danger)' }}
                            title="Remove leave record"
                          >
                            <FiTrash2 />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
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
              <span className={styles.statValue}>
                {(() => {
                  const completedTasksCount = tasks.filter(t => t.status === 'completed').length;
                  if (tasks.length === 0 && projects.length === 0) return '0.0 / 5.0';
                  if (tasks.length === 0) return '0.0 / 5.0';
                  const rating = (completedTasksCount / tasks.length) * 5;
                  return `${rating.toFixed(1)} / 5.0`;
                })()}
              </span>
              <span className={styles.statLabel}>Overall Rating</span>
            </div>
          </div>

          <div className={styles.statTile}>
            <div className={styles.statIconWrapper} style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
              <FiCheckCircle />
            </div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>
                {(() => {
                  const completedProjects = projects.filter(p => p.status?.toLowerCase() === 'completed' || p.status?.toLowerCase() === 'delivered');
                  if (completedProjects.length === 0) return '0%';
                  const onTimeCount = completedProjects.filter(p => !p.expected_completion_date || new Date(p.expected_completion_date) >= new Date()).length;
                  return `${Math.round((onTimeCount / completedProjects.length) * 100)}%`;
                })()}
              </span>
              <span className={styles.statLabel}>On-Time Delivery</span>
            </div>
          </div>

          <div className={styles.statTile}>
            <div className={styles.statIconWrapper}>
              <FiFolder />
            </div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>
                {projects.filter(p => p.status?.toLowerCase() === 'completed' || p.status?.toLowerCase() === 'delivered').length}
              </span>
              <span className={styles.statLabel}>Projects Delivered</span>
            </div>
          </div>

          <div className={styles.statTile}>
            <div className={styles.statIconWrapper}>
              <FiZap />
            </div>
            <div className={styles.statDetails}>
              <span className={styles.statValue}>
                {tasks.filter(t => t.status === 'completed').length > 0 ? 'Top 10%' : 'N/A'}
              </span>
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
              <strong>Performance Assessment:</strong> {profile.evaluationSummary || `${user.name || 'Team member'} is actively handling assigned workspace deliverables as ${user.role_name || 'a team member'}.`}
            </p>
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Badge variant="accent">{user.role_name || 'Team Member'}</Badge>
              <Badge variant="neutral">Resource Allocation</Badge>
              <Badge variant={projects.length > 0 ? 'success' : 'neutral'}>
                {projects.length > 0 ? `${projects.length} Projects Assigned` : 'Awaiting Assignment'}
              </Badge>
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

          <Input
            label="Annual Leave Quota (Days / Year)"
            type="number"
            min="0"
            max="365"
            placeholder={`Company Default (${tenantSettings?.leave_policy?.default_annual_quota || 18} Days)`}
            value={accountForm.annual_leave_quota}
            onChange={e => setAccountForm({ ...accountForm, annual_leave_quota: e.target.value })}
            helperText={`Individual employee entitlement. Leave empty to inherit company policy (${tenantSettings?.leave_policy?.default_annual_quota || 18} days/yr).`}
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
            required
            placeholder="e.g. Identity Proof / Passport / Contract"
            value={newDocForm.title}
            onChange={e => setNewDocForm({ ...newDocForm, title: e.target.value })}
          />
          <Select
            label="Document Category"
            value={newDocForm.category}
            options={[
              { value: 'Identification', label: 'Identification (Passport/ID)' },
              { value: 'Agreement', label: 'Agreement & Employment Contract' },
              { value: 'Academic', label: 'Academic & Professional Certificate' },
              { value: 'Taxation', label: 'Taxation & Financial Document' },
              { value: 'Other', label: 'Other Document / Attachment' }
            ]}
            onChange={val => setNewDocForm({ ...newDocForm, category: val })}
          />
          <label 
            style={{ 
              border: '2px dashed var(--color-border)', 
              borderRadius: 'var(--radius-lg)', 
              padding: 'var(--space-6)', 
              textAlign: 'center', 
              background: 'var(--color-bg)',
              cursor: 'pointer',
              display: 'block'
            }}
          >
            <input
              type="file"
              style={{ display: 'none' }}
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  const f = e.target.files[0]
                  setNewDocForm(prev => ({
                    ...prev,
                    file: f,
                    title: prev.title || f.name.replace(/\.[^/.]+$/, '')
                  }))
                }
              }}
            />
            <FiUploadCloud style={{ fontSize: '32px', color: 'var(--color-accent)', marginBottom: '8px' }} />
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
              {newDocForm.file ? newDocForm.file.name : 'Click to select a file from your computer'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              {newDocForm.file ? `${(newDocForm.file.size / 1024).toFixed(1)} KB` : 'PDF, PNG, JPG up to 10MB'}
            </div>
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <Button variant="secondary" onClick={() => setIsUploadDocOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleUploadDocument}>
              Upload Document
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  const renderLeaveRequestModal = () => {
    if (!isLeaveModalOpen) return null
    return (
      <Modal
        isOpen={isLeaveModalOpen}
        title="Record Leave for Employee"
        onClose={() => setIsLeaveModalOpen(false)}
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Select
            label="Leave Type"
            value={leaveForm.leave_type}
            options={[
              { value: 'Annual Paid Leave', label: 'Annual Paid Leave' },
              { value: 'Casual Leave', label: 'Casual Leave' },
              { value: 'Sick Leave', label: 'Sick / Medical Leave' },
              { value: 'Unpaid Leave', label: 'Unpaid Leave / Loss of Pay' },
              { value: 'Compensatory Off', label: 'Compensatory Off' }
            ]}
            onChange={val => setLeaveForm({ ...leaveForm, leave_type: val })}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <Input
              label="Start Date"
              type="date"
              required
              value={leaveForm.start_date}
              onChange={e => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
            />
            <Input
              label="End Date (Optional)"
              type="date"
              value={leaveForm.end_date}
              onChange={e => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
            />
          </div>

          <Input
            label="Duration (Number of Days)"
            type="number"
            min="0.5"
            step="0.5"
            value={leaveForm.duration}
            onChange={e => setLeaveForm({ ...leaveForm, duration: e.target.value })}
          />

          <Input
            label="Reason / Notes"
            placeholder="e.g. Vacation, personal appointment, medical rest"
            value={leaveForm.reason}
            onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
            <Button variant="secondary" onClick={() => setIsLeaveModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleRecordLeave}>
              Save Leave Record
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  const renderAuditDetailModal = () => {
    if (!selectedAuditLog) return null
    const info = getAuditActionInfo(selectedAuditLog.action)
    const oldVal = parseSafe(selectedAuditLog.old_value)
    const newVal = parseSafe(selectedAuditLog.new_value)
    const actor = getActorDisplay(selectedAuditLog)
    const device = getDeviceDisplay(selectedAuditLog)

    let diffRows = []
    if (oldVal && newVal && typeof oldVal === 'object' && typeof newVal === 'object') {
      const allKeys = Array.from(new Set([...Object.keys(oldVal), ...Object.keys(newVal)]))
        .filter(k => !['updated_at', 'id', 'user_id', 'tenant_id', 'created_at', 'password_hash'].includes(k))
      
      diffRows = allKeys
        .filter(k => JSON.stringify(oldVal[k]) !== JSON.stringify(newVal[k]))
        .map(k => ({
          field: FIELD_LABELS[k] || k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          oldV: formatFieldValue(oldVal[k]),
          newV: formatFieldValue(newVal[k])
        }))
    } else if (newVal && typeof newVal === 'object') {
      const keys = Object.keys(newVal).filter(k => !['updated_at', 'id', 'user_id', 'tenant_id', 'created_at', 'password_hash'].includes(k))
      diffRows = keys.map(k => ({
        field: FIELD_LABELS[k] || k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        oldV: 'None',
        newV: formatFieldValue(newVal[k])
      }))
    }

    return (
      <Modal
        isOpen={Boolean(selectedAuditLog)}
        title="Activity Log Details"
        onClose={() => setSelectedAuditLog(null)}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Header Info Banner */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className={styles.auditActionIcon} style={{ width: '36px', height: '36px', fontSize: '18px' }}>
                {info.icon}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--color-text)' }}>
                  {info.label}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  {selectedAuditLog.created_at && !isNaN(new Date(selectedAuditLog.created_at).getTime()) ? format(new Date(selectedAuditLog.created_at), 'PPP p') : '-'}
                </div>
              </div>
            </div>
            <Badge variant={info.variant}>{info.category}</Badge>
          </div>

          {/* Key Context Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--space-3)' }}>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Initiated By</div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)', marginTop: '4px' }}>{actor}</div>
            </div>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Device / Browser</div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)', marginTop: '4px' }}>{device}</div>
            </div>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Access Channel</div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)', marginTop: '4px' }}>
                Secure Web Connection
              </div>
            </div>
          </div>

          {/* Activity Description */}
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-2)' }}>
              Activity Description
            </div>
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
              {getAuditSummary(selectedAuditLog)}
            </div>
          </div>

          {/* Differences / Updates Table */}
          {diffRows.length > 0 ? (
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
                Field Changes & Updates
              </div>
              <table className={styles.diffTable}>
                <thead>
                  <tr>
                    <th>Setting / Field</th>
                    <th>Previous Value</th>
                    <th>Updated Value</th>
                  </tr>
                </thead>
                <tbody>
                  {diffRows.map((row, idx) => (
                    <tr key={idx}>
                      <td className={styles.diffField}>{row.field}</td>
                      <td><span className={styles.diffOld}>{row.oldV}</span></td>
                      <td><span className={styles.diffNew}>{row.newV}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : selectedAuditLog.action?.startsWith('user.login') ? (
            <div style={{ padding: 'var(--space-4)', background: 'rgba(34, 197, 94, 0.06)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FiShield style={{ color: 'var(--color-success)', fontSize: '20px', flexShrink: 0 }} />
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                Authentication verified. The employee signed into their account from <strong>{device}</strong>.
              </div>
            </div>
          ) : null}

          {/* Modal Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
            <Button variant="secondary" onClick={() => setSelectedAuditLog(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  const userInitial = user.name ? user.name.charAt(0).toUpperCase() : '?'
  const userDept = departments.find(d => d.id === user.department_id)?.name || profile.department || null

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
                <span className={styles.designationBadge}>{profile.designation || user.role_name || 'Team Member'}</span>
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
                  <FiShield /> {user.role_name || 'Team Member'}
                </span>

                {userDept && (
                  <>
                    <span className={styles.metaDivider}>•</span>
                    <span className={styles.metaItem}>
                      <FiBriefcase /> {userDept}
                    </span>
                  </>
                )}

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
                Login Credentials
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
                if (item.countKey === 'documents') count = Array.isArray(profile.documents) ? profile.documents.length : 0

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
      {renderLeaveRequestModal()}
      {renderAuditDetailModal()}

    </div>
  )
}
