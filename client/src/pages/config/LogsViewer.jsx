import { useState, useEffect } from 'react'
import layoutStyles from './ConfigLayout.module.css'
import styles from './LogsViewer.module.css'
import { Badge, DataTable, Select, Input, Button } from '../../components/ui'
import { useToast } from '../../store/toastContext'

export default function LogsViewer() {
  const [activeTab, setActiveTab] = useState('deliveries')
  const [deliveries, setDeliveries] = useState([])
  const [automations, setAutomations] = useState([])
  const [inbounds, setInbounds] = useState([]) // currently stubbed
  const toast = useToast()

  useEffect(() => {
    // Mock Deliveries
    setDeliveries([
      { id: '1', timestamp: new Date(Date.now()-60000).toISOString(), event: 'lead.created', webhook: 'Zapier Lead Sync', status: 200, latency: 120, attempt: 1, payload: { id: 'l_123', name: 'John Doe', source: 'Website' } },
      { id: '2', timestamp: new Date(Date.now()-3600000).toISOString(), event: 'project.phase_completed', webhook: 'ERP Integration', status: 500, latency: 650, attempt: 3, payload: { projectId: 'p_456', phase: 'Design', status: 'Completed' } },
    ])

    // Mock Automations
    setAutomations([
      { id: '1', timestamp: new Date(Date.now()-120000).toISOString(), ruleName: 'Assign to Sales Manager', trigger: 'lead.created', entity: 'Lead: John Doe', status: 'completed', actions: ['Update Owner', 'Send Notification'], duration: 45, matchedConditions: ['source == "Website"'], errors: null },
      { id: '2', timestamp: new Date(Date.now()-4000000).toISOString(), ruleName: 'Send Follow-up Email', trigger: 'lead.stage_changed', entity: 'Lead: Jane Smith', status: 'failed', actions: ['Send Email'], duration: 800, matchedConditions: ['stage == "Contacted"'], errors: ['SMTP Connection Timeout'] },
      { id: '3', timestamp: new Date(Date.now()-5000000).toISOString(), ruleName: 'Auto-archive Stale Leads', trigger: 'schedule.daily', entity: 'System', status: 'skipped', actions: [], duration: 5, matchedConditions: [], errors: null },
    ])
  }, [])

  const handleRetry = (id) => {
    toast.info('Retrying webhook delivery...')
  }

  const deliveryColumns = [
    { key: 'timestamp', label: 'Timestamp', render: (r) => new Date(r.timestamp).toLocaleString() },
    { key: 'event', label: 'Event' },
    { key: 'webhook', label: 'Webhook' },
    { 
      key: 'status', label: 'Status', 
      render: (r) => {
        if (r.status >= 200 && r.status < 300) return <Badge variant="success">{r.status}</Badge>
        if (r.status >= 400 && r.status < 500) return <Badge variant="warning">{r.status}</Badge>
        return <Badge variant="danger">{r.status}</Badge>
      }
    },
    { 
      key: 'latency', label: 'Latency', 
      render: (r) => {
        const cls = r.latency < 100 ? styles.latencySuccess : r.latency <= 500 ? styles.latencyWarning : styles.latencyDanger
        return <span className={cls}>{r.latency}ms</span>
      }
    },
    { key: 'attempt', label: 'Attempt', render: (r) => `${r.attempt}/3` },
    { 
      key: 'actions', label: '', align: 'right',
      render: (r) => r.status >= 400 && (
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleRetry(r.id) }}>Retry</Button>
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
          <DataTable 
            columns={deliveryColumns} 
            data={deliveries} 
            expandable 
            renderExpandedRow={(row) => (
              <div className={styles.expandedContent}>
                <div style={{fontWeight:500, marginBottom:8, fontSize:'var(--text-sm)'}}>Payload</div>
                <div className={styles.codeBlock}>{JSON.stringify(row.payload, null, 2)}</div>
              </div>
            )}
          />
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
    </div>
  )
}
