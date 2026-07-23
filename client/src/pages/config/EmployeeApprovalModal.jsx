import { useState, useEffect } from 'react'
import { Modal, Button, Textarea, Badge } from '../../components/ui'
import api from '../../api/axios'
import { useToast } from '../../store/toastContext'

export default function EmployeeApprovalModal({ isOpen, onClose, user, onStatusChange }) {
  const toast = useToast()
  const [history, setHistory] = useState([])
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  useEffect(() => {
    if (isOpen && user?.id) {
      api.get(`/users/${user.id}/approval-history`)
        .then(res => setHistory(res.data.data || []))
        .catch(err => console.error('Failed to load history', err))
    }
  }, [isOpen, user])

  const handleAction = async (action) => {
    if ((action === 'reject' || action === 'request-changes') && !comment.trim()) {
      return toast.error('A comment is required for this action.')
    }
    
    setIsSubmitting(true)
    try {
      await api.post(`/users/${user.id}/${action}`, { comments: comment })
      toast.success(`User ${action} processed successfully.`)
      onStatusChange(user.id, action === 'approve' ? 'active' : action === 'reject' ? 'rejected' : 'changes_requested')
      onClose()
      setComment('')
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || `Failed to ${action} user.`)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!user) return null

  const profile = user.profile_data || {}

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Review Employee: ${user.name}`}
      size="xl"
      style={{ width: '90vw', maxWidth: '800px' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Read-only details - Comprehensive */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ background: 'var(--color-background-soft)', padding: '16px', borderRadius: '8px' }}>
            <h4 style={{ marginBottom: '12px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>Basic Information</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
              <div><strong>Employee ID:</strong> {profile.employeeId || 'N/A'}</div>
              <div><strong>Name:</strong> {profile.firstName} {profile.middleName} {profile.lastName}</div>
              <div><strong>Display Name:</strong> {profile.displayName || 'N/A'}</div>
              <div><strong>Gender:</strong> {profile.gender || 'N/A'}</div>
              <div><strong>Date of Birth:</strong> {profile.dob || 'N/A'}</div>
            </div>
          </div>

          <div style={{ background: 'var(--color-background-soft)', padding: '16px', borderRadius: '8px' }}>
            <h4 style={{ marginBottom: '12px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>Contact Information</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
              <div><strong>Official Email:</strong> {profile.officialEmail || user.email}</div>
              <div><strong>Personal Email:</strong> {profile.personalEmail || 'N/A'}</div>
              <div><strong>Mobile Number:</strong> {profile.mobileNumber || 'N/A'}</div>
              <div><strong>Emergency Contact:</strong> {profile.emergencyContact || 'N/A'}</div>
              <div style={{ gridColumn: '1 / -1' }}><strong>Address:</strong> {profile.address ? `${profile.address}, ${profile.city}, ${profile.state}, ${profile.country} - ${profile.pinCode}` : 'N/A'}</div>
            </div>
          </div>

          <div style={{ background: 'var(--color-background-soft)', padding: '16px', borderRadius: '8px' }}>
            <h4 style={{ marginBottom: '12px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>Company Information</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
              <div><strong>Department:</strong> {profile.department || 'N/A'}</div>
              <div><strong>Designation:</strong> {profile.designation || 'N/A'}</div>
              <div><strong>Role:</strong> {user.role_name || 'N/A'}</div>
              <div><strong>Reporting Manager:</strong> {profile.reportingManager || 'N/A'}</div>
              <div><strong>Branch/Location:</strong> {profile.branch || 'N/A'} / {profile.officeLocation || 'N/A'}</div>
              <div><strong>Joining Date:</strong> {profile.joiningDate || 'N/A'}</div>
              <div><strong>Employment Type:</strong> {profile.employmentType || 'N/A'} ({profile.workMode || 'N/A'})</div>
              <div><strong>Probation End:</strong> {profile.probationEndDate || 'N/A'}</div>
            </div>
          </div>

          <div style={{ background: 'var(--color-background-soft)', padding: '16px', borderRadius: '8px' }}>
            <h4 style={{ marginBottom: '12px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>Security & Permissions</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
              <div><strong>Username:</strong> {profile.username || 'N/A'}</div>
              <div><strong>Temp Password:</strong> {profile.tempPassword ? '*** (Set)' : 'Auto-Generate'}</div>
              <div><strong>Two-Factor Auth:</strong> {profile.twoFactorAuth ? 'Enabled' : 'Disabled'}</div>
              <div style={{ gridColumn: '1 / -1' }}><strong>Accessible Modules:</strong> {profile.accessibleModules?.map(m => m.label).join(', ') || 'None'}</div>
              <div><strong>CRUD Permissions:</strong> {profile.crudPermissions ? 'Yes' : 'No'}</div>
              <div><strong>Export Permission:</strong> {profile.exportPermission ? 'Yes' : 'No'}</div>
              <div><strong>Print Permission:</strong> {profile.printPermission ? 'Yes' : 'No'}</div>
              <div><strong>Approval Permission:</strong> {profile.approvalPermission ? 'Yes' : 'No'}</div>
            </div>
          </div>

          {(profile.internalNotes) && (
             <div style={{ background: 'var(--color-background-soft)', padding: '16px', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '12px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>Internal Notes</h4>
              <div style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>{profile.internalNotes}</div>
            </div>
          )}

        </div>

        {/* Action area */}
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
          <h4 style={{ marginBottom: '8px', fontWeight: 600 }}>Reviewer Decision</h4>
          <Textarea 
            placeholder="Add a comment or reason (Required for Rejection/Changes)..." 
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
          />
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <Button variant="primary" onClick={() => handleAction('approve')} disabled={isSubmitting}>
              Approve & Activate
            </Button>
            <Button variant="ghost" style={{color: 'var(--color-warning)'}} onClick={() => handleAction('request-changes')} disabled={isSubmitting}>
              Request Changes
            </Button>
            <Button variant="ghost" style={{color: 'var(--color-danger)'}} onClick={() => handleAction('reject')} disabled={isSubmitting}>
              Reject
            </Button>
          </div>
        </div>

        {/* History Timeline */}
        {history.length > 0 && (
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
            <h4 style={{ marginBottom: '16px', fontWeight: 600 }}>Approval History</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {history.map(item => (
                <div key={item.id} style={{ padding: '12px', background: 'var(--color-background-soft)', borderRadius: '6px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong>{item.reviewer_name}</strong>
                    <span style={{ color: 'var(--color-text-muted)' }}>{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Badge variant={item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'danger' : 'warning'}>
                      {item.status ? item.status.toUpperCase() : 'UNKNOWN'}
                    </Badge>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{item.comments || 'No comment provided.'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
