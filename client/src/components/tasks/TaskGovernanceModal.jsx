import React, { useState } from 'react'
import { Modal, Button } from '../ui'
import { useGovernance } from '../../store/TaskGovernanceContext'
import { useToast } from '../../store/toastContext'

export default function TaskGovernanceModal({ isOpen, onClose }) {
  const { webhooks, setWebhooks, retentionDays, setRetentionDays, permissions } = useGovernance()
  const [newWebhook, setNewWebhook] = useState('')
  const toast = useToast()

  const handleAddWebhook = () => {
    if (!newWebhook.trim() || !newWebhook.startsWith('http')) {
      toast.error('Invalid URL')
      return
    }
    setWebhooks([...webhooks, { id: Date.now(), url: newWebhook }])
    setNewWebhook('')
    toast.success('Webhook added')
  }

  const handleRemoveWebhook = (id) => {
    setWebhooks(webhooks.filter(w => w.id !== id))
  }

  if (!permissions.canConfig) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="🛡️ Enterprise Governance">
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-danger)' }}>
          You do not have Administrator privileges to configure governance settings.
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🛡️ Enterprise Governance Settings" size="md">
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Retention Policy */}
        <div>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '15px' }}>Activity Log Retention</h3>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
            Configure how long immutable audit logs are kept before being pruned.
          </p>
          <select 
            value={retentionDays} 
            onChange={(e) => {
              setRetentionDays(e.target.value)
              toast.success('Retention policy updated')
            }}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
          >
            <option value="30">30 Days</option>
            <option value="90">90 Days</option>
            <option value="365">1 Year</option>
            <option value="indefinite">Indefinite (Never delete)</option>
          </select>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)' }} />

        {/* API Webhooks */}
        <div>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '15px' }}>API Webhooks</h3>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
            Trigger external URLs when a task is updated, deleted, or transitioned.
          </p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input 
              type="text" 
              placeholder="https://your-api.com/webhook" 
              value={newWebhook}
              onChange={e => setNewWebhook(e.target.value)}
              style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
            />
            <Button variant="primary" onClick={handleAddWebhook}>Add URL</Button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {webhooks.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No webhooks configured.</div>
            ) : (
              webhooks.map(w => (
                <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface)', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '13px', fontFamily: 'monospace' }}>{w.url}</div>
                  <Button variant="danger" size="sm" onClick={() => handleRemoveWebhook(w.id)}>Remove</Button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </Modal>
  )
}
