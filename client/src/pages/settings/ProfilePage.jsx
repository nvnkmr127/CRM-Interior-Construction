import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './ProfilePage.module.css'
import { useAuth } from '../../store/authContext'
import { useToast } from '../../store/toastContext'
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { Avatar, Badge, Button } from '../../components/ui'
import api from '../../api/axios'

export default function ProfilePage() {
  usePageTitle('My Profile')
  useBreadcrumbs([{label:'My Profile'}])
  
  const { user, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  // Profile Form
  const [name, setName] = useState(user?.name || 'Test User')
  const [profileSaving, setProfileSaving] = useState(false)

  // Password Form
  const [pwdForm, setPwdForm] = useState({ current: '', new: '', confirm: '' })
  const [pwdSaving, setPwdSaving] = useState(false)

  const handleProfileSave = async (e) => {
    e.preventDefault()
    setProfileSaving(true)
    try {
      await api.patch('/auth/me', { name })
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
    if (window.confirm('Are you sure you want to sign out of all devices?')) {
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
      // In a real app, you would upload to S3 here.
      toast.success('Profile photo updated (simulated)')
    }
  }

  return (
    <div className={styles.page}>
      
      {/* Profile Section */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>Profile</div>
        <div className={styles.cardDesc}>Manage your personal information and avatar.</div>

        <div className={styles.avatarSection}>
          <Avatar name={name} size="xl" style={{width: 80, height: 80, fontSize: 32}} />
          <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>Change Photo</Button>
          <input type="file" ref={fileInputRef} className={styles.fileInput} accept="image/*" onChange={handlePhotoUpload} />
        </div>

        <form className={styles.form} onSubmit={handleProfileSave}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Full Name</label>
            <input type="text" className={styles.input} value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Email Address</label>
            <input type="email" className={`${styles.input} ${styles.inputReadOnly}`} value={user?.email || 'user@example.com'} readOnly />
            <div className={styles.helperText}>Contact admin to change email</div>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Role</label>
            <div>
              <Badge variant="neutral">{user?.role?.name || 'Admin'}</Badge>
            </div>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={profileSaving}>
            {profileSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Password Section */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>Change Password</div>
        <div className={styles.cardDesc}>Ensure your account is using a long, random password to stay secure.</div>

        <form className={styles.form} onSubmit={handlePasswordSave}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Current Password</label>
            <input type="password" className={styles.input} value={pwdForm.current} onChange={e => setPwdForm({...pwdForm, current: e.target.value})} required />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>New Password</label>
            <input type="password" className={styles.input} value={pwdForm.new} onChange={e => setPwdForm({...pwdForm, new: e.target.value})} required minLength={8} />
            {pwdForm.new.length > 0 && (
              <div className={styles.strengthBarContainer}>
                <div className={styles.strengthBar} style={{ width: strengthWidth, backgroundColor: strengthColor }} />
              </div>
            )}
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Confirm New Password</label>
            <input type="password" className={styles.input} value={pwdForm.confirm} onChange={e => setPwdForm({...pwdForm, confirm: e.target.value})} required minLength={8} />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={pwdSaving}>
            {pwdSaving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Danger Zone */}
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
  )
}
