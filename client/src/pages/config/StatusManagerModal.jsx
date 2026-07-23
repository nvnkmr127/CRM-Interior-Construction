import { useState, useEffect } from 'react'
import { Modal, Button, Textarea, Badge, Select } from '../../components/ui'
import api from '../../api/axios'
import { useToast } from '../../store/toastContext'

const VALID_TRANSITIONS = {
  'pending_approval': ['active', 'probation', 'rejected', 'changes_requested'],
  'changes_requested': ['pending_approval', 'rejected'],
  'rejected': ['pending_approval', 'archived'],
  'invited': ['onboarding', 'active'],
  'onboarding': ['probation', 'active'],
  'probation': ['active', 'terminated', 'resigned'],
  'active': ['suspended', 'locked', 'inactive', 'resigned', 'terminated'],
  'suspended': ['active', 'terminated'],
  'locked': ['active', 'terminated'],
  'inactive': ['active', 'archived'],
  'resigned': ['archived'],
  'terminated': ['archived'],
  'archived': ['active']
};

const STATUS_LABELS = {
  'pending_approval': 'Pending Approval',
  'changes_requested': 'Changes Requested',
  'rejected': 'Rejected',
  'invited': 'Invited',
  'onboarding': 'Onboarding',
  'probation': 'Probation',
  'active': 'Active',
  'suspended': 'Suspended',
  'locked': 'Locked',
  'inactive': 'Inactive',
  'resigned': 'Resigned',
  'terminated': 'Terminated',
  'archived': 'Archived'
}

export const STATUS_COLORS = {
  'pending_approval': 'warning',
  'changes_requested': 'warning',
  'invited': 'info',
  'onboarding': 'info',
  'probation': 'warning',
  'active': 'success',
  'suspended': 'danger',
  'locked': 'danger',
  'inactive': 'neutral',
  'resigned': 'neutral',
  'terminated': 'danger',
  'rejected': 'danger',
  'archived': 'neutral'
}

export default function StatusManagerModal({ isOpen, onClose, user, onStatusChange }) {
  const toast = useToast()
  const [history, setHistory] = useState([])
  const [newStatus, setNewStatus] = useState('')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('change') // 'change' or 'history'
  
  useEffect(() => {
    if (isOpen && user?.id) {
      setNewStatus('')
      setReason('')
      setActiveTab('change')
      api.get(`/users/${user.id}/status-history`)
        .then(res => setHistory(res.data.data || []))
        .catch(err => console.error('Failed to load status history', err))
    }
  }, [isOpen, user])

  const handleSubmit = async () => {
    if (!newStatus) return toast.error('Please select a new status.')
    if (!reason.trim()) return toast.error('A reason is required for status changes.')
    
    setIsSubmitting(true)
    try {
      await api.patch(`/users/${user.id}`, { status: newStatus, status_reason: reason })
      toast.success(`User status updated to ${STATUS_LABELS[newStatus]}`)
      onStatusChange(user.id, newStatus)
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to update status.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!user) return null

  const allowedTransitions = VALID_TRANSITIONS[user.status] || []
  const options = allowedTransitions.map(s => ({ value: s, label: STATUS_LABELS[s] }))

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Manage Status: ${user.name}`}
      size="md"
    >
      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--color-border)', marginBottom: '16px' }}>
        <div 
          style={{ paddingBottom: '8px', cursor: 'pointer', fontWeight: activeTab === 'change' ? 600 : 400, color: activeTab === 'change' ? 'var(--color-primary)' : 'var(--color-text-secondary)', borderBottom: activeTab === 'change' ? '2px solid var(--color-primary)' : '2px solid transparent' }} 
          onClick={() => setActiveTab('change')}
        >
          Change Status
        </div>
        <div 
          style={{ paddingBottom: '8px', cursor: 'pointer', fontWeight: activeTab === 'history' ? 600 : 400, color: activeTab === 'history' ? 'var(--color-primary)' : 'var(--color-text-secondary)', borderBottom: activeTab === 'history' ? '2px solid var(--color-primary)' : '2px solid transparent' }} 
          onClick={() => setActiveTab('history')}
        >
          History Timeline
        </div>
      </div>

      {activeTab === 'change' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>Current Status:</span>
            <Badge variant={STATUS_COLORS[user.status] || 'neutral'}>{STATUS_LABELS[user.status] || user.status}</Badge>
          </div>

          {options.length > 0 ? (
            <>
              <Select 
                label="New Status"
                options={options}
                value={newStatus}
                onChange={setNewStatus}
              />
              
              <Textarea 
                label="Reason / Comment (Required)"
                placeholder="Explain why this status is being changed..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting || !newStatus || !reason.trim()}>
                  Confirm Change
                </Button>
              </div>
            </>
          ) : (
            <div style={{ padding: '16px', background: 'var(--color-background-soft)', borderRadius: '8px', color: 'var(--color-text-secondary)' }}>
              No further status transitions are available from the current state.
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
          {history.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)' }}>No status changes recorded yet.</div>
          ) : (
            history.map(item => (
              <div key={item.id} style={{ padding: '12px', background: 'var(--color-background-soft)', borderRadius: '6px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong>{item.changed_by_name || 'System'}</strong>
                  <span style={{ color: 'var(--color-text-muted)' }}>{new Date(item.created_at).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <Badge variant="neutral">{STATUS_LABELS[item.old_status] || item.old_status}</Badge>
                  <span>→</span>
                  <Badge variant={STATUS_COLORS[item.new_status] || 'neutral'}>{STATUS_LABELS[item.new_status] || item.new_status}</Badge>
                </div>
                {item.reason && (
                  <div style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                    "{item.reason}"
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </Modal>
  )
}
