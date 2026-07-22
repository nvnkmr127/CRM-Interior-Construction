/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react'
import layoutStyles from './ConfigLayout.module.css'
import styles from './LogsViewer.module.css'
import { Badge, DataTable, Select, Input, Button, Modal } from '../../components/ui'
import { useToast } from '../../store/toastContext'
import { configApi } from '../../api/config'

export default function LogsViewer() {
  const [activeTab, setActiveTab] = useState('deliveries')
  const [deliveries, setDeliveries] = useState([])
  const [automations, setAutomations] = useState([])
  const [inbounds, setInbounds] = useState([])
  const [selectedLog, setSelectedLog] = useState(null)
  const toast = useToast()

  useEffect(() => {
    if (activeTab === 'deliveries') {
      configApi.getWebhookLogs().then(data => {
        setDeliveries(data.data.map(l => ({
          id: l.id, 
          timestamp: l.created_at, 
          event: l.event, 
          webhook: l.webhook_id || l.webhook?.name || 'Unknown', 
          status: l.status_code, 
          latency: l.latency_ms, 
          attempt: l.attempt_number || l.attempt_count, 
          payload: l.payload,
          reqHeaders: l.request_headers,
          resHeaders: l.response_headers,
          responseBody: l.response_body,
          error: l.error || null,
          debugMode: !!l.request_headers
        })))
      }).catch(() => toast.error('Failed to load webhook logs'))
    } else if (activeTab === 'inbound') {
      configApi.getInboundLogs().then(data => {
        setInbounds(data.data || [])
      }).catch(() => toast.error('Failed to load inbound logs'))
    }
  }, [activeTab])

  useEffect(() => {
    // Automations logging not yet supported in backend, using mock
    setAutomations([
      { id: '1', timestamp: new Date(Date.now()-120000).toISOString(), ruleName: 'Assign to Sales Manager', trigger: 'lead.created', entity: 'Lead: John Doe', status: 'completed', actions: ['Update Owner', 'Send Notification'], duration: 45, matchedConditions: ['source == "Website"'], errors: null },
      { id: '2', timestamp: new Date(Date.now()-4000000).toISOString(), ruleName: 'Send Follow-up Email', trigger: 'lead.stage_changed', entity: 'Lead: Jane Smith', status: 'failed', actions: ['Send Email'], duration: 800, matchedConditions: ['stage == "Contacted"'], errors: ['SMTP Connection Timeout'] },
      { id: '3', timestamp: new Date(Date.now()-5000000).toISOString(), ruleName: 'Auto-archive Stale Leads', trigger: 'schedule.daily', entity: 'System', status: 'skipped', actions: [], duration: 5, matchedConditions: [], errors: null },
    ])
  }, [])

  const handleRetry = async (id) => {
    toast.info('Retrying webhook delivery...')
    try {
      await configApi.retryWebhook(id)
      toast.success('Webhook retry initiated')
    } catch (err) {
      toast.error('Failed to retry webhook')
    }
  }

  const deliveryColumns = [
    { key: 'webhook', label: 'Webhook', render: (r) => <div style={{fontWeight:500}}>{r.webhook}</div> },
    { key: 'event', label: 'Event', render: (r) => <Badge variant="neutral">{r.event}</Badge> },
    { key: 'timestamp', label: 'Date', render: (r) => <div style={{fontSize:'var(--text-sm)'}}>{new Date(r.timestamp).toLocaleString()}</div> },
    { 
      key: 'status', label: 'Response Code', 
      render: (r) => {
        if (!r.status) return <Badge variant="neutral">Pending</Badge>
        if (r.status >= 200 && r.status < 300) return <Badge variant="success">{r.status}</Badge>
        if (r.status >= 400 && r.status < 500) return <Badge variant="warning">{r.status}</Badge>
        return <Badge variant="danger">{r.status}</Badge>
      }
    },
    { 
      key: 'deliveryStatus', label: 'Delivery Status', 
      render: (r) => {
        if (!r.status) return <span style={{fontSize:'var(--text-sm)', color:'var(--color-text-muted)'}}>In Progress</span>
        return r.status >= 200 && r.status < 300 
          ? <span style={{fontSize:'var(--text-sm)', color:'var(--color-success)'}}>Success</span> 
          : <span style={{fontSize:'var(--text-sm)', color:'var(--color-danger)'}}>Failed</span>
      }
    },
    { 
      key: 'latency', label: 'Duration', 
      render: (r) => <span style={{fontSize:'var(--text-sm)'}}>{r.latency}ms</span>
    },
    { key: 'attempt', label: 'Attempt', render: (r) => <span style={{fontSize:'var(--text-sm)'}}>{r.attempt}</span> },
    { key: 'debug', label: 'Debug Status', render: (r) => r.debugMode ? <Badge variant="warning">ON</Badge> : <span style={{fontSize:'var(--text-sm)', color:'var(--color-text-muted)'}}>OFF</span> },
    { 
      key: 'actions', label: 'Actions', align: 'right',
      render: (r) => (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={() => setSelectedLog(r)}>Inspect</Button>
          {r.status >= 400 && (
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRetry(r.id) }}>Retry</Button>
          )}
        </div>
      )
    }
  ]

  const automationColumns = [
    { key: 'timestamp', label: 'Timestamp', render: (r) => new Date(r.timestamp).toLocaleString() },
    { key: 'ruleName', label: 'Rule Name' },
    { key: 'trigger', label: 'Trigger' },
    { key: 'entity', label: 'Entity' },
    { 
      key: 'status', label: 'Status', 
      render: (r) => {
        const variants = { completed: 'success', failed: 'danger', skipped: 'neutral' }
        return <Badge variant={variants[r.status]}>{r.status}</Badge>
      }
    },
    { key: 'actionsExecuted', label: 'Actions Executed', render: (r) => r.actions.join(', ') || '-' },
    { key: 'duration', label: 'Duration', render: (r) => `${r.duration}ms` }
  ]

  return (
    <div className={layoutStyles.configSection}>
      <div className={layoutStyles.sectionHeader}>
        <div>
          <h2 className={layoutStyles.sectionTitle}>System Logs</h2>
          <p className={layoutStyles.sectionDesc}>Review API calls, webhook deliveries, and automation runs.</p>
        </div>
      </div>

      <div className={styles.tabs}>
        <div className={`${styles.tab} ${activeTab === 'deliveries' ? styles.active : ''}`} onClick={() => setActiveTab('deliveries')}>Webhook Deliveries</div>
        <div className={`${styles.tab} ${activeTab === 'automations' ? styles.active : ''}`} onClick={() => setActiveTab('automations')}>Automation Runs</div>
        <div className={`${styles.tab} ${activeTab === 'inbound' ? styles.active : ''}`} onClick={() => setActiveTab('inbound')}>Inbound Webhooks</div>
      </div>

      {activeTab === 'deliveries' && (
        <div>
          <div className={styles.filters}>
            <Select 
              label="Webhook" 
              options={[{value:'all',label:'All Webhooks'}, {value:'zapier',label:'Zapier Lead Sync'}, {value:'erp',label:'ERP Integration'}]} 
              value="all" 
              onChange={()=>{}}
            />
            <Select 
              label="Status" 
              options={[{value:'all',label:'All Statuses'}, {value:'success',label:'Success (2xx)'}, {value:'failed',label:'Failed (4xx/5xx)'}]} 
              value="all" 
              onChange={()=>{}}
            />
            <Input label="Date range" type="date" value="" onChange={()=>{}} />
          </div>
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
            <DataTable 
              columns={deliveryColumns} 
              data={deliveries} 
            />
          </div>
        </div>
      )}

      {activeTab === 'automations' && (
        <div>
          <div className={styles.filters}>
            <Select 
              label="Status" 
              options={[{value:'all',label:'All Statuses'}, {value:'completed',label:'Completed'}, {value:'failed',label:'Failed'}, {value:'skipped',label:'Skipped'}]} 
              value="all" 
              onChange={()=>{}}
            />
            <Input label="Rule Name" placeholder="Search rules..." value="" onChange={()=>{}} />
          </div>
          <DataTable 
            columns={automationColumns} 
            data={automations} 
            expandable 
            renderExpandedRow={(row) => (
              <div className={styles.expandedContent}>
                <div style={{display:'flex', gap:'32px'}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:500, marginBottom:8, fontSize:'var(--text-sm)'}}>Matched Conditions</div>
                    {row.matchedConditions.length > 0 ? (
                      <ul style={{fontSize:'13px', margin:0, paddingLeft:20}}>{row.matchedConditions.map((c,i)=><li key={i}>{c}</li>)}</ul>
                    ) : <div style={{fontSize:'13px', color:'var(--color-text-muted)'}}>None</div>}
                  </div>
                  {row.errors && (
                    <div style={{flex:1}}>
                      <div style={{fontWeight:500, color:'var(--color-danger)', marginBottom:8, fontSize:'var(--text-sm)'}}>Errors</div>
                      <div className={styles.codeBlock} style={{color:'#f87171'}}>{row.errors.join('\n')}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          />
        </div>
      )}

      {activeTab === 'inbound' && (
        <div style={{padding:'32px', textAlign:'center', color:'var(--color-text-muted)'}}>
          Inbound Webhook logs are currently empty.
        </div>
      )}

      {/* Log Inspector Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Webhook Delivery Details"
        size="xl"
      >
        {selectedLog && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ padding: 16, background: 'var(--color-background)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Webhook & Event</div>
                <div style={{ fontWeight: 500 }}>{selectedLog.webhook} — {selectedLog.event}</div>
              </div>
              <div style={{ padding: 16, background: 'var(--color-background)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Execution Info</div>
                <div style={{ fontWeight: 500 }}>{new Date(selectedLog.timestamp).toLocaleString()} • {selectedLog.latency}ms • Attempt {selectedLog.attempt}</div>
              </div>
            </div>

            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <div style={{ background: 'var(--color-background)', padding: '8px 16px', fontWeight: 500, borderBottom: '1px solid var(--color-border)' }}>Request Payload</div>
              <pre className={styles.codeBlock} style={{ margin: 0, border: 'none', borderRadius: 0, maxHeight: 300, overflow: 'auto' }}>
                {typeof selectedLog.payload === 'object' ? JSON.stringify(selectedLog.payload, null, 2) : selectedLog.payload}
              </pre>
            </div>

            {selectedLog.debugMode && selectedLog.reqHeaders && (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ background: 'var(--color-background)', padding: '8px 16px', fontWeight: 500, borderBottom: '1px solid var(--color-border)' }}>Request Headers (Debug)</div>
                <pre className={styles.codeBlock} style={{ margin: 0, border: 'none', borderRadius: 0, maxHeight: 200, overflow: 'auto' }}>
                  {typeof selectedLog.reqHeaders === 'string' ? JSON.stringify(JSON.parse(selectedLog.reqHeaders), null, 2) : JSON.stringify(selectedLog.reqHeaders, null, 2)}
                </pre>
              </div>
            )}

            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <div style={{ background: 'var(--color-background)', padding: '8px 16px', fontWeight: 500, borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Response Body</span>
                <span>Status: {selectedLog.status}</span>
              </div>
              <pre className={styles.codeBlock} style={{ margin: 0, border: 'none', borderRadius: 0, maxHeight: 300, overflow: 'auto' }}>
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(selectedLog.responseBody), null, 2);
                  } catch {
                    return selectedLog.responseBody || 'No response body';
                  }
                })()}
              </pre>
            </div>

            {selectedLog.debugMode && selectedLog.resHeaders && (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ background: 'var(--color-background)', padding: '8px 16px', fontWeight: 500, borderBottom: '1px solid var(--color-border)' }}>Response Headers (Debug)</div>
                <pre className={styles.codeBlock} style={{ margin: 0, border: 'none', borderRadius: 0, maxHeight: 200, overflow: 'auto' }}>
                  {typeof selectedLog.resHeaders === 'string' ? JSON.stringify(JSON.parse(selectedLog.resHeaders), null, 2) : JSON.stringify(selectedLog.resHeaders, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.error && (
              <div style={{ border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '8px 16px', fontWeight: 500, borderBottom: '1px solid var(--color-danger)' }}>Error Information</div>
                <pre className={styles.codeBlock} style={{ margin: 0, border: 'none', borderRadius: 0, maxHeight: 200, overflow: 'auto', color: 'var(--color-danger)', background: '#fff' }}>
                  {typeof selectedLog.error === 'object' ? JSON.stringify(selectedLog.error, null, 2) : selectedLog.error}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
