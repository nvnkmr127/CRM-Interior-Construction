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
  
  // Interlink CRM Webhooks
  const [webhooks, setWebhooks] = useState([])
  const [deliveryFilters, setDeliveryFilters] = useState({ webhook: 'all', status: 'all', date: '' })
  const [autoFilters, setAutoFilters] = useState({ status: 'all', search: '' })
  
  const toast = useToast()

  useEffect(() => {
    configApi.getWebhooks().then(data => {
      setWebhooks(data.data || data || [])
    }).catch(console.error)
  }, [])

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

  const filteredDeliveries = deliveries.filter(d => {
    if (deliveryFilters.webhook !== 'all' && d.webhook !== deliveryFilters.webhook) return false;
    if (deliveryFilters.status !== 'all') {
      const isSuccess = d.status >= 200 && d.status < 300;
      if (deliveryFilters.status === 'success' && !isSuccess) return false;
      if (deliveryFilters.status === 'failed' && isSuccess) return false;
    }
    if (deliveryFilters.date) {
      const dDate = new Date(d.timestamp).toISOString().split('T')[0];
      if (dDate !== deliveryFilters.date) return false;
    }
    return true;
  });

  const filteredAutomations = automations.filter(a => {
    if (autoFilters.status !== 'all' && a.status !== autoFilters.status) return false;
    if (autoFilters.search && !a.ruleName.toLowerCase().includes(autoFilters.search.toLowerCase())) return false;
    return true;
  });

  const webhookOptions = [
    { value: 'all', label: 'All Webhooks' },
    ...webhooks.map(w => ({ value: w.name, label: w.name }))
  ];

  return (
    <div className="fade-in bg-slate-50" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className={layoutStyles.sectionHeader} style={{ flexShrink: 0, margin: 0, padding: '24px 32px', borderBottom: '1px solid var(--color-border)', backgroundColor: '#fff' }}>
        <div>
          <h2 className={layoutStyles.sectionTitle}>System Logs</h2>
          <p className={layoutStyles.sectionDesc}>Review API calls, webhook deliveries, and automation runs.</p>
        </div>
      </div>

      <div style={{ flexShrink: 0, padding: '0 32px', backgroundColor: '#fff', borderBottom: '1px solid var(--color-border)' }}>
        <div className={styles.tabs} style={{ marginBottom: 0, borderBottom: 'none' }}>
          <div className={`${styles.tab} ${activeTab === 'deliveries' ? styles.active : ''}`} onClick={() => setActiveTab('deliveries')}>Webhook Deliveries</div>
          <div className={`${styles.tab} ${activeTab === 'automations' ? styles.active : ''}`} onClick={() => setActiveTab('automations')}>Automation Runs</div>
          <div className={`${styles.tab} ${activeTab === 'inbound' ? styles.active : ''}`} onClick={() => setActiveTab('inbound')}>Inbound Webhooks</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
        {activeTab === 'deliveries' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className={styles.filters} style={{ flexShrink: 0, marginBottom: 24 }}>
              <Select 
                label="Webhook" 
                options={webhookOptions} 
                value={deliveryFilters.webhook} 
                onChange={(v) => setDeliveryFilters({...deliveryFilters, webhook: v})}
              />
              <Select 
                label="Status" 
                options={[{value:'all',label:'All Statuses'}, {value:'success',label:'Success (2xx)'}, {value:'failed',label:'Failed (4xx/5xx)'}]} 
                value={deliveryFilters.status} 
                onChange={(v) => setDeliveryFilters({...deliveryFilters, status: v})}
              />
              <Input label="Date range" type="date" value={deliveryFilters.date} onChange={(e) => setDeliveryFilters({...deliveryFilters, date: e.target.value})} />
            </div>
            <div style={{ flex: 1, backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
              <DataTable 
                columns={deliveryColumns} 
                data={filteredDeliveries} 
                emptyMessage="No webhook deliveries found matching your filters."
              />
            </div>
          </div>
        )}

        {activeTab === 'automations' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className={styles.filters} style={{ flexShrink: 0, marginBottom: 24 }}>
              <Select 
                label="Status" 
                options={[{value:'all',label:'All Statuses'}, {value:'completed',label:'Completed'}, {value:'failed',label:'Failed'}, {value:'skipped',label:'Skipped'}]} 
                value={autoFilters.status} 
                onChange={(v) => setAutoFilters({...autoFilters, status: v})}
              />
              <div style={{ width: 300 }}>
                <Input label="Search Rule" placeholder="Search rule name..." value={autoFilters.search} onChange={(e) => setAutoFilters({...autoFilters, search: e.target.value})} />
              </div>
            </div>
            <div style={{ flex: 1, backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
              <DataTable 
                columns={automationColumns} 
                data={filteredAutomations} 
                expandable 
                emptyMessage="No automation runs found."
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
          </div>
        )}

      {activeTab === 'inbound' && (
        <div style={{padding:'32px', textAlign:'center', color:'var(--color-text-muted)'}}>
          Inbound Webhook logs are currently empty.
        </div>
      )}
      </div>

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
              <div className={layoutStyles.glassCard} style={{ padding: 16 }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Webhook & Event</div>
                <div style={{ fontWeight: 500 }}>{selectedLog.webhook} — {selectedLog.event}</div>
              </div>
              <div className={layoutStyles.glassCard} style={{ padding: 16 }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Execution Info</div>
                <div style={{ fontWeight: 500 }}>{new Date(selectedLog.timestamp).toLocaleString()} • {selectedLog.latency}ms • Attempt {selectedLog.attempt}</div>
              </div>
            </div>

            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <div style={{ background: 'var(--color-background)', padding: '10px 16px', fontWeight: 600, borderBottom: '1px solid var(--color-border)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Request Payload</div>
              <pre style={{ margin: 0, background: '#f8fafc', color: '#334155', padding: '16px', fontSize: '13px', fontFamily: 'var(--font-mono)', border: 'none', borderRadius: 0, maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {selectedLog.payload ? (typeof selectedLog.payload === 'object' ? JSON.stringify(selectedLog.payload, null, 2) : selectedLog.payload) : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No payload data</span>}
              </pre>
            </div>

            {selectedLog.debugMode && selectedLog.reqHeaders && (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ background: 'var(--color-background)', padding: '10px 16px', fontWeight: 600, borderBottom: '1px solid var(--color-border)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Request Headers (Debug)</div>
                <pre style={{ margin: 0, background: '#f8fafc', color: '#334155', padding: '16px', fontSize: '13px', fontFamily: 'var(--font-mono)', border: 'none', borderRadius: 0, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {typeof selectedLog.reqHeaders === 'string' ? JSON.stringify(JSON.parse(selectedLog.reqHeaders), null, 2) : JSON.stringify(selectedLog.reqHeaders, null, 2)}
                </pre>
              </div>
            )}

            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <div style={{ background: 'var(--color-background)', padding: '10px 16px', fontWeight: 600, borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <span>Response Body</span>
                <Badge variant={selectedLog.status >= 200 && selectedLog.status < 300 ? 'success' : 'danger'}>Status: {selectedLog.status || 'N/A'}</Badge>
              </div>
              <pre style={{ margin: 0, background: '#f8fafc', color: '#334155', padding: '16px', fontSize: '13px', fontFamily: 'var(--font-mono)', border: 'none', borderRadius: 0, maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {(() => {
                  if (!selectedLog.responseBody) return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No response body</span>;
                  try {
                    return JSON.stringify(JSON.parse(selectedLog.responseBody), null, 2);
                  } catch {
                    return selectedLog.responseBody;
                  }
                })()}
              </pre>
            </div>

            {selectedLog.debugMode && selectedLog.resHeaders && (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ background: 'var(--color-background)', padding: '10px 16px', fontWeight: 600, borderBottom: '1px solid var(--color-border)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Response Headers (Debug)</div>
                <pre style={{ margin: 0, background: '#f8fafc', color: '#334155', padding: '16px', fontSize: '13px', fontFamily: 'var(--font-mono)', border: 'none', borderRadius: 0, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {typeof selectedLog.resHeaders === 'string' ? JSON.stringify(JSON.parse(selectedLog.resHeaders), null, 2) : JSON.stringify(selectedLog.resHeaders, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.error && (
              <div style={{ border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '10px 16px', fontWeight: 600, borderBottom: '1px solid var(--color-danger)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Error Information</div>
                <pre style={{ margin: 0, background: '#fff', color: 'var(--color-danger)', padding: '16px', fontSize: '13px', fontFamily: 'var(--font-mono)', border: 'none', borderRadius: 0, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
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
