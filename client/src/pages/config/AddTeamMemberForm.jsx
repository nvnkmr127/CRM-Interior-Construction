import { useState, useEffect } from 'react'
import { Input, Select, Button, Toggle, Textarea } from '../../components/ui'
import api from '../../api/axios'
import { useToast } from '../../store/toastContext'

const SECTIONS = [
  'General Information',
  'Security'
]

const INITIAL_DATA = {
  // Basic
  employeeId: `EMP-${Math.floor(Math.random() * 90000) + 10000}`,
  firstName: '',
  officialEmail: '', 
  mobileNumber: '', 
  address: '',
  // Company
  role: '',
  department: '', 
  designation: '', 
  // Security
  username: '', tempPassword: '', forcePasswordReset: true, twoFactorAuth: false
}

export default function AddTeamMemberForm({ onCancel, onSuccess, roleOptions }) {
  const toast = useToast()
  const [activeSection, setActiveSection] = useState(0)
  const [formData, setFormData] = useState(INITIAL_DATA)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('onboarding_draft')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setFormData(prev => ({ ...prev, ...parsed }))
      } catch (e) {
        console.error('Failed to parse draft')
      }
    }
  }, [])

  // Auto-save to local storage on changes
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('onboarding_draft', JSON.stringify(formData))
    }, 1000)
    return () => clearTimeout(timer)
  }, [formData])

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleNext = () => {
    setActiveSection(prev => Math.min(prev + 1, SECTIONS.length - 1))
  }

  const handleBack = () => {
    setActiveSection(prev => Math.max(prev - 1, 0))
  }

  const handleSubmit = async () => {
    if (!formData.firstName) { toast.error('Name is required'); setActiveSection(0); return; }
    if (!formData.officialEmail) { toast.error('Email is required'); setActiveSection(0); return; }
    if (!formData.role) { toast.error('Role is required'); setActiveSection(0); return; }
    setIsSubmitting(true)
    try {
      const payload = {
        name: formData.firstName.trim(),
        email: formData.officialEmail,
        roleId: formData.role,
        ...formData
      }
      
      const res = await api.post('/users/add-member', payload)
      toast.success('Team member added successfully and pending approval!')
      localStorage.removeItem('onboarding_draft')
      if (onSuccess) onSuccess(res.data?.data)
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to submit form')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Progress / Sections Header */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', overflowX: 'auto', marginBottom: '28px', gap: '16px' }}>
        {SECTIONS.map((sec, idx) => (
          <div 
            key={sec}
            onClick={() => setActiveSection(idx)}
            style={{ 
              padding: '14px 20px', 
              cursor: 'pointer',
              borderBottom: activeSection === idx ? '3px solid var(--color-primary)' : '3px solid transparent',
              color: activeSection === idx ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: activeSection === idx ? 600 : 500,
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
              fontSize: '15px'
            }}
          >
            {idx + 1}. {sec}
          </div>
        ))}
      </div>

      {/* Form Content */}
      <div style={{ flex: 1, overflow: 'visible', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {activeSection === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <Input label="Name *" value={formData.firstName} onChange={e => handleInputChange('firstName', e.target.value)} />
              <Input type="email" label="Email *" value={formData.officialEmail} onChange={e => handleInputChange('officialEmail', e.target.value)} />
              
              <Input type="tel" label="Mobile Number" value={formData.mobileNumber} onChange={e => handleInputChange('mobileNumber', e.target.value)} />
              <Select label="Role *" options={roleOptions} value={formData.role} onChange={v => handleInputChange('role', v)} />
              
              <Input label="Department" value={formData.department} onChange={e => handleInputChange('department', e.target.value)} />
              <Input label="Designation" value={formData.designation} onChange={e => handleInputChange('designation', e.target.value)} />
            </div>
            
            <div style={{ width: '100%' }}>
              <Textarea label="Address" value={formData.address} onChange={e => handleInputChange('address', e.target.value)} rows={3} />
            </div>
          </div>
        )}

        {activeSection === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <Input label="Username" value={formData.username} onChange={e => handleInputChange('username', e.target.value)} />
              <Input type="password" label="Temporary Password" value={formData.tempPassword} onChange={e => handleInputChange('tempPassword', e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
              <Toggle checked={formData.forcePasswordReset} onChange={() => handleInputChange('forcePasswordReset', !formData.forcePasswordReset)} />
              <span style={{ fontSize: '14px', color: 'var(--color-text)' }}>Force Password Reset on First Login</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
              <Toggle checked={formData.twoFactorAuth} onChange={() => handleInputChange('twoFactorAuth', !formData.twoFactorAuth)} />
              <span style={{ fontSize: '14px', color: 'var(--color-text)' }}>Require Two-Factor Authentication (2FA)</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: '20px', marginTop: '24px', paddingBottom: '8px' }}>
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <div style={{ display: 'flex', gap: '16px' }}>
          {activeSection > 0 && <Button variant="ghost" onClick={handleBack} disabled={isSubmitting}>Back</Button>}
          {activeSection < SECTIONS.length - 1 ? (
            <Button variant="primary" onClick={handleNext}>Next Step</Button>
          ) : (
            <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Complete Onboarding'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
