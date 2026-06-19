import { useState, useEffect } from 'react'
import layoutStyles from './ConfigLayout.module.css'
import styles from './WebhooksManager.module.css'
import { Button, Badge, Modal, Input, Select } from '../../components/ui'
import { useToast } from '../../store/toastContext'
import api from '../../api/axios'

const EVENT_GROUPS = [
  { label: 'Lead Events', events: ['lead.created', 'lead.updated', 'lead.stage_changed', 'lead.converted'] },
  { label: 'Project Events', events: ['project.created', 'project.phase_completed', 'project.task_completed'] },
  { label: 'Payment Events', events: ['payment.milestone_due', 'payment.received'] },
  { label: 'Client Events', events: ['client.design_approved', 'client.snag_raised'] }
]

export default function WebhooksManager() {
  const [webhooks, setWebhooks] = useState([])
  const [testResults, setTestResults] = useState({})
  const [testingId, setTestingId] = useState(null)
  
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  
  const toast = useToast()

  useEffect(() => {
    fetchWebhooks()
  }, [])

  const fetchWebhooks = async () => {
    try {
      const res = await api.get('/config/webhooks')
      const formatted = res.data.data.map(w => ({
        id: w.id,
        name: w.name,
        url: w.url,
        active: w.is_active,
        events: w.events || [],
        headers: Object.entries(w.custom_headers || {}).map(([key, value]) => ({ key, value })),
        retryCount: w.retry_count || 3,
        // Since delivery logs might need a separate query, we use mock lastDelivery here unless backend exposes it
        lastDelivery: null
      }))
      setWebhooks(formatted)
    } catch (err) {
      toast.error('Failed to load webhooks')
    }
  }

  const handleTest = async (id) => {
    setTestingId(id)
    try {
      const res = await api.post(`/config/webhooks/${id}/test`)
      const { statusCode, latencyMs, success } = res.data.data
      const result = success 
        ? { type: 'success', msg: `✓ Delivered in ${latencyMs}ms — Status ${statusCode}` }
        : { type: 'fail', msg: `✕ Failed — Status ${statusCode || 'Unknown Error'}` }
      
      setTestResults(prev => ({ ...prev, [id]: result }))
    } catch (err) {
      setTestResults(prev => ({ ...prev, [id]: { type: 'fail', msg: '✕ Test request failed completely.' } }))
    } finally {
      setTestingId(null)
      setTimeout(() => {
        setTestResults(prev => {
          const next = {...prev}
          delete next[id]
          return next
        })
      }, 10000)
    }
  }

  const toggleActive = async (id) => {
    try {
      await api.patch(`/config/webhooks/${id}/toggle`)
      setWebhooks(webhooks.map(w => w.id === id ? {...w, active: !w.active} : w))
      toast.success('Webhook toggled')
    } catch (err) {
      toast.error('Failed to toggle webhook')
    }
  }

  const openEditor = (webhook = null) => {
    if (webhook) {
      setEditTarget({ ...webhook, events: new Set(webhook.events) })
    } else {
      setEditTarget({ name: '', url: '', secret: '', active: true, events: new Set(), headers: [], retryCount: 3 })
    }
    setIsEditOpen(true)
  }

  const saveWebhook = async () => {
    if (!editTarget.name || !editTarget.url) return toast.error('Name and URL are required')
    
    // Map headers array to object
    const headersObj = {}
    editTarget.headers.forEach(h => {
      if (h.key && h.value) headersObj[h.key] = h.value
    })

    const payload = {
      name: editTarget.name,
      url: editTarget.url,
      secret: editTarget.secret,
      events: Array.from(editTarget.events),
      custom_headers: headersObj,
      retry_count: editTarget.retryCount
    }
    
    try {
      if (editTarget.id) {
        await api.put(`/config/webhooks/${editTarget.id}`, payload)
        toast.success('Webhook updated')
      } else {
        await api.post('/config/webhooks', payload)
        toast.success('Webhook created')
      }
      setIsEditOpen(false)
      fetchWebhooks()
    } catch (err) {
      toast.error('Failed to save webhook')
    }
  }

  const deleteWebhook = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/config/webhooks/${deleteTarget.id}`)
      setWebhooks(webhooks.filter(w => w.id !== deleteTarget.id))
      toast.success('Webhook deleted')
    } catch (err) {
      toast.error('Failed to delete webhook')
    } finally {
      setDeleteTarget(null)
    }
  }

  const toggleEvent = (e) => {
    const next = new Set(editTarget.events)
    if (next.has(e)) next.delete(e)
    else next.add(e)
    setEditTarget({...editTarget, events: next})
  }

  return (
    <div className={layoutStyles.configSection}>
      <div className={layoutStyles.sectionHeader}>
        <div>
          <h2 className={layoutStyles.sectionTitle}>Outbound Webhooks</h2>
          <p className={layoutStyles.sectionDesc}>Send real-time events to external systems.</p>
        </div>
        <Button variant="primary" onClick={() => openEditor()}>+ Add Webhook</Button>
      </div>

      <div className={styles.cardList}>
        {webhooks.map(w => (
          <div key={w.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.nameRow}>
                <div className={styles.webhookName}>{w.name}</div>
                <div className={`${styles.toggle} ${w.active ? styles.active : ''}`} onClick={() => toggleActive(w.id)}>
                  <div className={styles.toggleHandle} />
                </div>
              </div>
            </div>
            
            <div className={styles.urlBox}>
              <span className={styles.urlText}>{w.url}</span>
              <span className={styles.copyIcon} onClick={() => { navigator.clipboard.writeText(w.url); toast.info('Copied URL') }}>📋</span>
            </div>

            <div className={styles.metaRow}>
              <Badge variant="neutral">{w.events.length} event{w.events.length !== 1 && 's'}</Badge>
              {w.lastDelivery && (
                <span className={w.lastDelivery.success ? styles.statusSuccess : styles.statusFail}>
                  {w.lastDelivery.success ? '✓ 200 OK' : `✕ ${w.lastDelivery.status} · ${w.lastDelivery.message}`} 
                  <span style={{color:'var(--color-text-muted)', fontWeight:400, marginLeft:4}}>
                    · {new Date(w.lastDelivery.time).toLocaleString()}
                  </span>
                </span>
              )}
            </div>

            <div className={styles.cardFooter}>
              <Button variant="ghost" size="sm" onClick={() => openEditor(w)}>Edit</Button>
              <Button variant="secondary" size="sm" onClick={() => handleTest(w.id)} disabled={testingId === w.id}>
                {testingId === w.id ? 'Testing...' : 'Test'}
              </Button>
              <Button variant="ghost" size="sm" style={{color:'var(--color-danger)', marginLeft:'auto'}} onClick={() => setDeleteTarget(w)}>
                Delete
              </Button>
            </div>

            {testResults[w.id] && (
              <div className={`${styles.testResult} ${testResults[w.id].type === 'success' ? styles.testSuccess : styles.testFail}`}>
                {testResults[w.id].msg}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Editor Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={editTarget?.id ? 'Edit Webhook' : 'Add Webhook'}
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveWebhook}>Save Webhook</Button>
          </>
        }
      >
        {editTarget && (
          <div className={styles.modalBody}>
            {/* Left Col */}
            <div className={styles.col}>
              <Input label="Name" value={editTarget.name} onChange={e => setEditTarget({...editTarget, name: e.target.value})} required />
              <Input label="URL" value={editTarget.url} onChange={e => setEditTarget({...editTarget, url: e.target.value})} required />
              <Input label="Secret (used to sign requests)" value={editTarget.secret} onChange={e => setEditTarget({...editTarget, secret: e.target.value})} placeholder="Auto-generate if empty" />
              
              <div>
                <div style={{fontSize:'var(--text-sm)', fontWeight:500, marginBottom:8}}>Custom Headers</div>
                <div className={styles.headersList}>
                  {editTarget.headers.map((h, i) => (
                    <div key={i} className={styles.headerRow}>
                      <Input placeholder="Key" value={h.key} onChange={e => {
                        const newHeaders = [...editTarget.headers]
                        newHeaders[i].key = e.target.value
                        setEditTarget({...editTarget, headers: newHeaders})
                      }} />
                      <Input placeholder="Value" value={h.value} onChange={e => {
                        const newHeaders = [...editTarget.headers]
                        newHeaders[i].value = e.target.value
                        setEditTarget({...editTarget, headers: newHeaders})
                      }} />
                      <Button variant="ghost" size="sm" onClick={() => setEditTarget({...editTarget, headers: editTarget.headers.filter((_, idx) => idx !== i)})}>✕</Button>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => setEditTarget({...editTarget, headers: [...editTarget.headers, {key:'', value:''}]})}>+ Add Header</Button>
                </div>
              </div>

              <Select 
                label="Retry Count" 
                options={[{value:1,label:'1'},{value:2,label:'2'},{value:3,label:'3'},{value:5,label:'5'}]} 
                value={editTarget.retryCount} 
                onChange={v => setEditTarget({...editTarget, retryCount: v})} 
              />
              
              <label style={{display:'flex', alignItems:'center', gap:8, fontSize:'var(--text-sm)', cursor:'pointer', marginTop:8}}>
                <input type="checkbox" checked={editTarget.active} onChange={e => setEditTarget({...editTarget, active: e.target.checked})} />
                Active
              </label>
            </div>

            {/* Right Col */}
            <div className={styles.col}>
              <div style={{fontSize:'var(--text-sm)', fontWeight:500}}>Events</div>
              <div className={styles.eventsGrid}>
                {EVENT_GROUPS.map(group => (
                  <div key={group.label} className={styles.eventGroup}>
                    <div className={styles.eventTitle}>{group.label}</div>
                    {group.events.map(ev => (
                      <label key={ev} className={styles.eventRow}>
                        <input type="checkbox" checked={editTarget.events.has(ev)} onChange={() => toggleEvent(ev)} />
                        {ev}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Webhook"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={deleteWebhook}>Delete</Button>
          </>
        }
      >
        <p>Are you sure you want to delete the webhook <strong>{deleteTarget?.name}</strong>?</p>
      </Modal>
    </div>
  )
}
