import { useState, useEffect } from 'react'
import { Input, Select, Button, Toggle, Textarea } from '../../components/ui'
import api from '../../api/axios'
import { useToast } from '../../store/toastContext'

const SECTIONS = [
  'Basic Information',
  'Contact Information',
  'Company Information',
  'Security',
  'Permissions',
  'Documents',
  'Notes'
]

const INITIAL_DATA = {
  // Basic
  employeeId: `EMP-${Math.floor(Math.random() * 90000) + 10000}`,
  firstName: '', middleName: '', lastName: '', displayName: '', gender: '', dob: '', profilePhoto: null,
  // Contact
  officialEmail: '', personalEmail: '', mobileNumber: '', emergencyContact: '', address: '', city: '', state: '', country: '', pinCode: '',
  // Company
  department: '', designation: '', role: '', reportingManager: '', branch: '', officeLocation: '', joiningDate: '', employmentType: '', workMode: '', probationEndDate: '',
  // Security
  username: '', tempPassword: '', forcePasswordReset: true, twoFactorAuth: false,
  // Permissions
  accessibleModules: [], crudPermissions: false, exportPermission: false, printPermission: false, approvalPermission: false,
  // Documents (We will store file names/references here)
  resume: null, aadhaar: null, pan: null, passport: null, offerLetter: null, nda: null, employmentAgreement: null,
  // Notes
  internalNotes: ''
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
      // Exclude file objects from serialization
      const { profilePhoto, resume, aadhaar, pan, passport, offerLetter, nda, employmentAgreement, ...saveData } = formData
      localStorage.setItem('onboarding_draft', JSON.stringify(saveData))
    }, 1000)
    return () => clearTimeout(timer)
  }, [formData])

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const validateSection = (sectionIndex) => {
    // Basic validation
    if (sectionIndex === 0) {
      if (!formData.firstName) { toast.error('First Name is required'); return false; }
    }
    if (sectionIndex === 1) {
      if (!formData.officialEmail) { toast.error('Official Email is required'); return false; }
    }
    if (sectionIndex === 2) {
      if (!formData.role) { toast.error('Role is required'); return false; }
    }
    return true
  }

  const handleNext = () => {
    if (validateSection(activeSection)) {
      setActiveSection(prev => Math.min(prev + 1, SECTIONS.length - 1))
    }
  }

  const handleBack = () => {
    setActiveSection(prev => Math.max(prev - 1, 0))
  }

  const handleSubmit = async () => {
    if (!validateSection(activeSection)) return
    setIsSubmitting(true)
    try {
      // In a real scenario, documents would be uploaded first and URLs attached here
      // For now, we omit file objects from the JSON payload or replace with mock URLs
      const payload = {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
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
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', overflowX: 'auto', marginBottom: '24px' }}>
        {SECTIONS.map((sec, idx) => (
          <div 
            key={sec}
            onClick={() => { if (idx < activeSection || validateSection(activeSection)) setActiveSection(idx) }}
            style={{ 
              padding: '12px 16px', 
              cursor: 'pointer',
              borderBottom: activeSection === idx ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeSection === idx ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              fontWeight: activeSection === idx ? 600 : 400,
              whiteSpace: 'nowrap'
            }}
          >
            {idx + 1}. {sec}
          </div>
        ))}
      </div>

      {/* Form Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {activeSection === 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Input label="Employee ID" value={formData.employeeId} disabled />
            <Input label="First Name *" value={formData.firstName} onChange={e => handleInputChange('firstName', e.target.value)} />
            <Input label="Middle Name" value={formData.middleName} onChange={e => handleInputChange('middleName', e.target.value)} />
            <Input label="Last Name" value={formData.lastName} onChange={e => handleInputChange('lastName', e.target.value)} />
            <Input label="Display Name" value={formData.displayName} onChange={e => handleInputChange('displayName', e.target.value)} />
            <Select label="Gender" options={[{value:'Male',label:'Male'}, {value:'Female',label:'Female'}, {value:'Other',label:'Other'}]} value={formData.gender} onChange={v => handleInputChange('gender', v)} />
            <Input type="date" label="Date of Birth" value={formData.dob} onChange={e => handleInputChange('dob', e.target.value)} />
            <Input type="file" label="Profile Photo" onChange={e => handleInputChange('profilePhoto', e.target.files[0])} />
          </div>
        )}

        {activeSection === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Input type="email" label="Official Email *" value={formData.officialEmail} onChange={e => handleInputChange('officialEmail', e.target.value)} />
            <Input type="email" label="Personal Email" value={formData.personalEmail} onChange={e => handleInputChange('personalEmail', e.target.value)} />
            <Input type="tel" label="Mobile Number" value={formData.mobileNumber} onChange={e => handleInputChange('mobileNumber', e.target.value)} />
            <Input type="tel" label="Emergency Contact" value={formData.emergencyContact} onChange={e => handleInputChange('emergencyContact', e.target.value)} />
            <div style={{ gridColumn: '1 / -1' }}>
              <Textarea label="Address" value={formData.address} onChange={e => handleInputChange('address', e.target.value)} />
            </div>
            <Input label="City" value={formData.city} onChange={e => handleInputChange('city', e.target.value)} />
            <Input label="State" value={formData.state} onChange={e => handleInputChange('state', e.target.value)} />
            <Input label="Country" value={formData.country} onChange={e => handleInputChange('country', e.target.value)} />
            <Input label="PIN Code" value={formData.pinCode} onChange={e => handleInputChange('pinCode', e.target.value)} />
          </div>
        )}

        {activeSection === 2 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Select label="Role *" options={roleOptions} value={formData.role} onChange={v => handleInputChange('role', v)} />
            <Input label="Department" value={formData.department} onChange={e => handleInputChange('department', e.target.value)} />
            <Input label="Designation" value={formData.designation} onChange={e => handleInputChange('designation', e.target.value)} />
            <Input label="Reporting Manager" value={formData.reportingManager} onChange={e => handleInputChange('reportingManager', e.target.value)} />
            <Input label="Branch" value={formData.branch} onChange={e => handleInputChange('branch', e.target.value)} />
            <Input label="Office Location" value={formData.officeLocation} onChange={e => handleInputChange('officeLocation', e.target.value)} />
            <Input type="date" label="Joining Date" value={formData.joiningDate} onChange={e => handleInputChange('joiningDate', e.target.value)} />
            <Input type="date" label="Probation End Date" value={formData.probationEndDate} onChange={e => handleInputChange('probationEndDate', e.target.value)} />
            <Select label="Employment Type" options={[{value:'Full-time',label:'Full-time'},{value:'Part-time',label:'Part-time'},{value:'Contract',label:'Contract'}]} value={formData.employmentType} onChange={v => handleInputChange('employmentType', v)} />
            <Select label="Work Mode" options={[{value:'On-site',label:'On-site'},{value:'Remote',label:'Remote'},{value:'Hybrid',label:'Hybrid'}]} value={formData.workMode} onChange={v => handleInputChange('workMode', v)} />
          </div>
        )}

        {activeSection === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input label="Username" value={formData.username} onChange={e => handleInputChange('username', e.target.value)} />
            <Input type="password" label="Temporary Password" value={formData.tempPassword} onChange={e => handleInputChange('tempPassword', e.target.value)} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Toggle checked={formData.forcePasswordReset} onChange={() => handleInputChange('forcePasswordReset', !formData.forcePasswordReset)} />
              <span>Force Password Reset on First Login</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Toggle checked={formData.twoFactorAuth} onChange={() => handleInputChange('twoFactorAuth', !formData.twoFactorAuth)} />
              <span>Require Two-Factor Authentication (2FA)</span>
            </div>
          </div>
        )}

        {activeSection === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Select 
              label="Accessible Modules" 
              options={[{value:'leads',label:'Leads'}, {value:'projects',label:'Projects'}, {value:'finance',label:'Finance'}, {value:'inventory',label:'Inventory'}, {value:'reports',label:'Reports'}]} 
              value={formData.accessibleModules} 
              onChange={v => handleInputChange('accessibleModules', v)} 
              multi
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
              <Toggle checked={formData.crudPermissions} onChange={() => handleInputChange('crudPermissions', !formData.crudPermissions)} />
              <span>Allow CRUD Operations (Create, Read, Update, Delete)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Toggle checked={formData.exportPermission} onChange={() => handleInputChange('exportPermission', !formData.exportPermission)} />
              <span>Allow Data Export</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Toggle checked={formData.printPermission} onChange={() => handleInputChange('printPermission', !formData.printPermission)} />
              <span>Allow Printing Records</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Toggle checked={formData.approvalPermission} onChange={() => handleInputChange('approvalPermission', !formData.approvalPermission)} />
              <span>Can Approve Financials & Stages</span>
            </div>
          </div>
        )}

        {activeSection === 5 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Input type="file" label="Resume" onChange={e => handleInputChange('resume', e.target.files[0])} />
            <Input type="file" label="Aadhaar Card" onChange={e => handleInputChange('aadhaar', e.target.files[0])} />
            <Input type="file" label="PAN Card" onChange={e => handleInputChange('pan', e.target.files[0])} />
            <Input type="file" label="Passport" onChange={e => handleInputChange('passport', e.target.files[0])} />
            <Input type="file" label="Offer Letter" onChange={e => handleInputChange('offerLetter', e.target.files[0])} />
            <Input type="file" label="NDA" onChange={e => handleInputChange('nda', e.target.files[0])} />
            <Input type="file" label="Employment Agreement" onChange={e => handleInputChange('employmentAgreement', e.target.files[0])} />
          </div>
        )}

        {activeSection === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Textarea label="Internal Notes" value={formData.internalNotes} onChange={e => handleInputChange('internalNotes', e.target.value)} rows={6} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: '16px', marginTop: '16px' }}>
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <div style={{ display: 'flex', gap: '12px' }}>
          {activeSection > 0 && <Button variant="ghost" onClick={handleBack} disabled={isSubmitting}>Back</Button>}
          {activeSection < SECTIONS.length - 1 ? (
            <Button variant="primary" onClick={handleNext}>Next</Button>
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
