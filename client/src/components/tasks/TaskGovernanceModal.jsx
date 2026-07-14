import React, { useState } from 'react'
import { Modal, Button } from '../ui'
import { useGovernance } from '../../store/TaskGovernanceContext'
import { useToast } from '../../store/toastContext'
import styles from './TaskGovernanceModal.module.css'

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
        <div className={styles.errorState}>
          You do not have Administrator privileges to configure governance settings.
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🛡️ Enterprise Governance Settings" size="md">
      <div className={styles.container}>
        
        {/* Retention Policy */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Activity Log Retention</h3>
          <p className={styles.sectionDesc}>
            Configure how long immutable audit logs are kept before being pruned.
          </p>
          <select 
            value={retentionDays} 
            onChange={(e) => {
              setRetentionDays(e.target.value)
              toast.success('Retention policy updated')
            }}
            className={styles.input}
          >
            <option value="30">30 Days</option>
            <option value="90">90 Days</option>
            <option value="365">1 Year</option>
            <option value="indefinite">Indefinite (Never delete)</option>
          </select>
        </div>

        <hr className={styles.divider} />

        {/* API Webhooks */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>API Webhooks</h3>
          <p className={styles.sectionDesc}>
            Trigger external URLs when a task is updated, deleted, or transitioned.
          </p>
          <div className={styles.inputGroup}>
            <input 
              type="text" 
              placeholder="https://your-api.com/webhook" 
              value={newWebhook}
              onChange={e => setNewWebhook(e.target.value)}
              className={styles.input}
            />
            <Button variant="primary" onClick={handleAddWebhook}>Add URL</Button>
          </div>
          
          <div className={styles.list}>
            {webhooks.length === 0 ? (
              <div className={styles.emptyText}>No webhooks configured.</div>
            ) : (
              webhooks.map(w => (
                <div key={w.id} className={styles.listItem}>
                  <div className={styles.listItemText}>{w.url}</div>
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
