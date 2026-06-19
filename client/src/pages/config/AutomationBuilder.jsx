import { useState, useEffect } from 'react'
import styles from './AutomationBuilder.module.css'
import { Button, Modal, Input, Select } from '../../components/ui'
import { useToast } from '../../store/toastContext'
import api from '../../api/axios'

const TRIGGER_TYPES = [
  { id: 'record_created', icon: '◉', label: 'Record Created' },
  { id: 'field_changed', icon: '◉', label: 'Field Changed' },
  { id: 'date_condition', icon: '◉', label: 'Date Condition' },
  { id: 'inbound_webhook', icon: '◉', label: 'Inbound Webhook' }
]

const ENTITIES = [{value:'lead',label:'Leads'}, {value:'project',label:'Projects'}, {value:'task',label:'Tasks'}]
const OPERATORS = [{value:'is',label:'is'}, {value:'is_not',label:'is not'}, {value:'contains',label:'contains'}, {value:'starts_with',label:'starts with'}, {value:'is_empty',label:'is empty'}]
const ACTION_TYPES = [{value:'',label:'Select Action'}, {value:'whatsapp',label:'Send WhatsApp'}, {value:'email',label:'Send Email'}, {value:'task',label:'Create Task'}, {value:'update',label:'Update Field'}, {value:'webhook',label:'Call Webhook'}]

export default function AutomationBuilder() {
  const [rules, setRules] = useState([])
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [step, setStep] = useState(1)
  const toast = useToast()

  const [draft, setDraft] = useState({
    id: null, name: '', triggerType: '', entity: '', watchField: '',
    conditions: [], actions: []
  })

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    try {
      const res = await api.get('/config/automations')
      const formatted = res.data.data.map(r => ({
        id: r.id,
        name: r.name,
        active: r.is_active,
        triggerSummary: `When ${r.trigger?.entity || 'record'}.${r.trigger?.type || 'event'} → ${r.actions?.length || 0} action(s)`,
        lastRun: r.last_run_at ? new Date(r.last_run_at).toLocaleString() : 'Never',
        triggerType: r.trigger?.type || '',
        entity: r.trigger?.entity || '',
        watchField: r.trigger?.watchField || '',
        conditions: r.conditions || [],
        actions: r.actions || []
      }))
      setRules(formatted)
    } catch (err) {
      toast.error('Failed to fetch automations')
    }
  }

  const openWizard = (rule = null) => {
    if (rule) {
      setDraft(rule)
    } else {
      setDraft({ id: null, name: '', triggerType: '', entity: '', watchField: '', conditions: [], actions: [] })
    }
    setStep(1)
    setIsWizardOpen(true)
  }

  const toggleActive = async (id) => {
    try {
      await api.patch(`/config/automations/${id}/toggle`)
      setRules(rules.map(r => r.id === id ? {...r, active: !r.active} : r))
      toast.success('Automation toggled')
    } catch (err) {
      toast.error('Failed to toggle automation')
    }
  }

  const deleteRule = async (id) => {
    if (!window.confirm('Delete this rule?')) return
    try {
      await api.delete(`/config/automations/${id}`)
      setRules(rules.filter(x => x.id !== id))
      toast.success('Automation deleted')
    } catch (err) {
      toast.error('Failed to delete automation')
    }
  }

  const testRun = async (id) => {
    try {
      // Pass a dummy record to simulate
      await api.post(`/config/automations/${id}/test-run`, { record: { test: true } })
      toast.success('Test run triggered successfully')
    } catch (err) {
      toast.error('Failed to trigger test run')
    }
  }

  const addCondition = () => {
    setDraft({ ...draft, conditions: [...draft.conditions, { field: '', op: 'is', val: '', log: 'AND' }] })
  }

  const addAction = () => {
    setDraft({ ...draft, actions: [...draft.actions, { type: '', config: {} }] })
  }

  const saveRule = async () => {
    if (!draft.name) return toast.error('Rule name required')
    if (draft.actions.length === 0) return toast.error('At least one action is required')
    
    const payload = {
      name: draft.name,
      trigger: {
        type: draft.triggerType,
        entity: draft.entity,
        watchField: draft.watchField
      },
      conditions: draft.conditions,
      actions: draft.actions
    }

    try {
      if (draft.id) {
        await api.put(`/config/automations/${draft.id}`, payload)
        toast.success('Automation updated')
      } else {
        await api.post('/config/automations', payload)
        toast.success('Automation created')
      }
      setIsWizardOpen(false)
      fetchRules()
    } catch (err) {
      toast.error('Failed to save automation rule')
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Automation Rules</h1>
          <div className={styles.desc}>Automate workflows and communications across your workspace.</div>
        </div>
        <Button variant="primary" onClick={() => openWizard()}>+ New Rule</Button>
      </div>

      <div className={styles.ruleList}>
        {rules.map(r => (
          <div key={r.id} className={styles.ruleCard}>
            <div className={styles.cardHeader}>
              <div className={styles.ruleName}>{r.name}</div>
              <div className={`${styles.toggle} ${r.active ? styles.active : ''}`} onClick={() => toggleActive(r.id)}>
                <div className={styles.toggleHandle} />
              </div>
            </div>
            
            <div className={styles.summary}>{r.triggerSummary}</div>
            
            <div className={styles.lastRun}>Last run: {r.lastRun}</div>
            
            <div className={styles.cardActions}>
              <Button variant="ghost" size="sm" onClick={() => openWizard(r)}>Edit</Button>
              <Button variant="secondary" size="sm" onClick={() => testRun(r.id)}>Test Run</Button>
              <Button variant="ghost" size="sm" style={{color:'var(--color-danger)'}} onClick={() => deleteRule(r.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>

      {/* Wizard Modal */}
      <Modal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        title="Automation Builder"
        size="xl"
        footer={
          <>
            {step > 1 ? (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>← Back</Button>
            ) : (
              <Button variant="ghost" onClick={() => setIsWizardOpen(false)}>Cancel</Button>
            )}
            
            {step < 3 ? (
              <Button variant="primary" onClick={() => setStep(step + 1)}>Next →</Button>
            ) : (
              <Button variant="primary" onClick={saveRule}>Save Rule</Button>
            )}
          </>
        }
      >
        <div className={styles.wizardHeader}>
          <div className={styles.progressBar}>
            <div className={styles.progressLine} />
            <div className={styles.progressLineActive} style={{width: `${((step - 1) / 2) * 100}%`}} />
            {[1, 2, 3].map(s => (
              <div key={s} className={`${styles.stepNode} ${step === s ? styles.active : step > s ? styles.completed : ''}`}>
                <div className={styles.stepCircle}>{step > s ? '✓' : s}</div>
                <div className={styles.stepLabel}>{s === 1 ? 'Trigger' : s === 2 ? 'Conditions' : 'Actions'}</div>
              </div>
            ))}
          </div>
          <Input 
            label="Rule Name *" 
            placeholder="e.g. New Lead Auto-Reply"
            value={draft.name}
            onChange={e => setDraft({...draft, name: e.target.value})}
          />
        </div>

        {step === 1 && (
          <div>
            <div style={{fontWeight:600, marginBottom:16}}>Select a Trigger</div>
            <div className={styles.triggerGrid}>
              {TRIGGER_TYPES.map(t => (
                <div 
                  key={t.id} 
                  className={`${styles.triggerCard} ${draft.triggerType === t.id ? styles.selected : ''}`}
                  onClick={() => setDraft({...draft, triggerType: t.id})}
                >
                  <div className={styles.triggerIcon}>{t.icon}</div>
                  <div className={styles.triggerTitle}>{t.label}</div>
                </div>
              ))}
            </div>

            {draft.triggerType && (
              <div style={{display:'flex', gap:16, marginTop:16}}>
                <div style={{flex:1}}>
                  <Select 
                    label="Entity" 
                    options={ENTITIES} 
                    value={draft.entity} 
                    onChange={v => setDraft({...draft, entity: v})} 
                  />
                </div>
                {draft.triggerType === 'field_changed' && (
                  <div style={{flex:1}}>
                    <Select 
                      label="Watch Field" 
                      options={[{value:'status',label:'Status'}, {value:'stage',label:'Stage'}]} 
                      value={draft.watchField} 
                      onChange={v => setDraft({...draft, watchField: v})} 
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{fontWeight:600, marginBottom:16}}>Only run this rule when...</div>
            {draft.conditions.map((c, i) => (
              <div key={i} className={styles.conditionRow}>
                <div className={styles.conditionField}>
                  <Select label="Field" options={[{value:'source',label:'Source'}, {value:'value',label:'Value'}]} value={c.field} onChange={v => {
                    const nc = [...draft.conditions]; nc[i].field = v; setDraft({...draft, conditions: nc})
                  }} />
                </div>
                <div className={styles.conditionOp}>
                  <Select label="Operator" options={OPERATORS} value={c.op} onChange={v => {
                    const nc = [...draft.conditions]; nc[i].op = v; setDraft({...draft, conditions: nc})
                  }} />
                </div>
                <div className={styles.conditionVal}>
                  <Input label="Value" value={c.val} onChange={e => {
                    const nc = [...draft.conditions]; nc[i].val = e.target.value; setDraft({...draft, conditions: nc})
                  }} />
                </div>
                {i > 0 && (
                  <div className={styles.conditionLog}>
                    <Select label="AND/OR" options={[{value:'AND',label:'AND'}, {value:'OR',label:'OR'}]} value={c.log} onChange={v => {
                      const nc = [...draft.conditions]; nc[i].log = v; setDraft({...draft, conditions: nc})
                    }} />
                  </div>
                )}
                <div>
                  <Button variant="ghost" size="sm" onClick={() => setDraft({...draft, conditions: draft.conditions.filter((_, idx) => idx !== i)})}>✕</Button>
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={addCondition}>+ Add Condition</Button>
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={{fontWeight:600, marginBottom:16}}>Perform these actions</div>
            {draft.actions.map((a, i) => (
              <div key={i} className={styles.actionBlock}>
                <div className={styles.actionHeader}>
                  <Select options={ACTION_TYPES} value={a.type} onChange={v => {
                    const na = [...draft.actions]; na[i].type = v; setDraft({...draft, actions: na})
                  }} />
                  <Button variant="ghost" size="sm" style={{color:'var(--color-danger)'}} onClick={() => setDraft({...draft, actions: draft.actions.filter((_, idx) => idx !== i)})}>✕</Button>
                </div>

                <div className={styles.actionConfig}>
                  {a.type === 'whatsapp' && (
                    <div style={{display:'flex', gap:16}}>
                      <div style={{flex:1}}><Input label="Template Name" /></div>
                      <div style={{flex:1}}><Select label="Recipient Field" options={[{value:'phone',label:'Phone Number'}]} /></div>
                    </div>
                  )}
                  {a.type === 'email' && (
                    <div style={{display:'grid', gap:16}}>
                      <Input label="Subject" />
                      <textarea style={{width:'100%', minHeight:80, padding:8, borderRadius:4, border:'1px solid var(--color-border)'}} placeholder="Email body..." />
                      <Select label="Recipient Field" options={[{value:'email',label:'Email Address'}]} />
                    </div>
                  )}
                  {a.type === 'task' && (
                    <div style={{display:'flex', gap:16}}>
                      <div style={{flex:2}}><Input label="Task Title" /></div>
                      <div style={{flex:1}}><Select label="Assignee Field" options={[{value:'pm',label:'Project Manager'}]} /></div>
                      <div style={{flex:1}}><Input label="Due (days)" type="number" /></div>
                    </div>
                  )}
                  {a.type === 'update' && (
                    <div style={{display:'flex', gap:16}}>
                      <div style={{flex:1}}><Select label="Field" options={[{value:'status',label:'Status'}]} /></div>
                      <div style={{flex:1}}><Input label="New Value" /></div>
                    </div>
                  )}
                  {a.type === 'webhook' && (
                    <div>
                      <Select label="Webhook" options={[{value:'w1',label:'Zapier Lead Sync'}]} />
                    </div>
                  )}
                </div>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={addAction}>+ Add Action</Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
