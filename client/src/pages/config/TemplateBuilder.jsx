import { useState, useEffect } from 'react'
import styles from './TemplateBuilder.module.css'
import { Button, Modal, Input, Select, Badge } from '../../components/ui'
import { useToast } from '../../store/toastContext'

const PROJECT_TYPES = [
  { value: 'full_interior', label: 'Full Interior' },
  { value: 'modular_kitchen', label: 'Modular Kitchen' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'turnkey', label: 'Turnkey' },
  { value: 'renovation', label: 'Renovation' }
]

export default function TemplateBuilder() {
  const [templates, setTemplates] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const toast = useToast()

  const [draft, setDraft] = useState({
    id: null, name: '', type: 'full_interior', desc: '',
    phases: []
  })

  useEffect(() => {
    setTemplates([
      { 
        id: '1', name: 'Standard 3BHK Interior', type: 'full_interior', 
        desc: 'Standard template for a 3BHK full home interior design & execution.',
        phases: [
          { id: 'p1', name: 'Design Phase', duration: 15, milestones: [
            { id: 'm1', name: 'Initial Layout Approval', triggersPayment: false },
            { id: 'm2', name: '3D Renders Sign-off', triggersPayment: true }
          ]},
          { id: 'p2', name: 'Execution Phase', duration: 45, milestones: [
            { id: 'm3', name: 'Material Delivery', triggersPayment: true },
            { id: 'm4', name: 'Carpentry Completion', triggersPayment: false }
          ]}
        ]
      }
    ])
  }, [])

  const openEditor = (tmpl = null) => {
    if (tmpl) {
      setDraft(JSON.parse(JSON.stringify(tmpl)))
    } else {
      setDraft({ id: null, name: '', type: 'full_interior', desc: '', phases: [] })
    }
    setIsModalOpen(true)
  }

  const addPhase = () => {
    setDraft({
      ...draft,
      phases: [...draft.phases, { id: Date.now().toString(), name: '', duration: 0, milestones: [] }]
    })
  }

  const addMilestone = (phaseIdx) => {
    const newPhases = [...draft.phases]
    newPhases[phaseIdx].milestones.push({ id: Date.now().toString(), name: '', triggersPayment: false })
    setDraft({ ...draft, phases: newPhases })
  }

  const saveTemplate = () => {
    if (!draft.name) return toast.error('Template name required')
    
    if (draft.id) {
      setTemplates(templates.map(t => t.id === draft.id ? draft : t))
    } else {
      setTemplates([...templates, { ...draft, id: Date.now().toString() }])
    }
    toast.success('Template saved successfully')
    setIsModalOpen(false)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Project Templates</h1>
          <div style={{color:'var(--color-text-secondary)', marginTop: 4}}>Standardize your project delivery.</div>
        </div>
        <Button variant="primary" onClick={() => openEditor()}>+ New Template</Button>
      </div>

      <div className={styles.templateList}>
        {templates.map(t => {
          const totalMilestones = t.phases.reduce((acc, p) => acc + p.milestones.length, 0)
          return (
            <div key={t.id} className={styles.card}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                <div className={styles.cardName}>{t.name}</div>
                <Badge variant="neutral">{t.type.replace('_', ' ')}</Badge>
              </div>
              <div className={styles.cardSummary}>{t.phases.length} phases, {totalMilestones} milestones</div>
              <p style={{fontSize: 'var(--text-sm)', color:'var(--color-text)', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>{t.desc}</p>
              
              <div className={styles.cardActions}>
                <Button variant="ghost" size="sm" onClick={() => openEditor(t)}>Edit</Button>
                <Button variant="ghost" size="sm" style={{color:'var(--color-danger)'}} onClick={() => setTemplates(templates.filter(x => x.id !== t.id))}>Delete</Button>
                <Button variant="secondary" size="sm" style={{marginLeft:'auto'}}>Apply to Project</Button>
              </div>
            </div>
          )
        })}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={draft.id ? 'Edit Template' : 'New Template'}
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveTemplate}>Save Template</Button>
          </>
        }
      >
        <div className={styles.modalBody}>
          <div className={styles.leftCol}>
            <div style={{display:'flex', gap:16}}>
              <div style={{flex:2}}><Input label="Template Name *" value={draft.name} onChange={e => setDraft({...draft, name: e.target.value})} /></div>
              <div style={{flex:1}}><Select label="Type" options={PROJECT_TYPES} value={draft.type} onChange={v => setDraft({...draft, type: v})} /></div>
            </div>
            
            <div style={{display:'flex', flexDirection:'column', gap:4}}>
              <label style={{fontSize:'var(--text-sm)', fontWeight:500}}>Description</label>
              <textarea style={{width:'100%', minHeight:60, padding:8, borderRadius:4, border:'1px solid var(--color-border)'}} value={draft.desc} onChange={e => setDraft({...draft, desc: e.target.value})} />
            </div>

            <div className={styles.sectionTitle} style={{marginTop: 16}}>Phases</div>
            {draft.phases.map((p, pIdx) => (
              <div key={p.id} className={styles.phaseBlock}>
                <div className={styles.phaseHeader}>
                  <div className={styles.dragHandle}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <circle cx="6" cy="4" r="1.5"/><circle cx="6" cy="8" r="1.5"/><circle cx="6" cy="12" r="1.5"/>
                      <circle cx="10" cy="4" r="1.5"/><circle cx="10" cy="8" r="1.5"/><circle cx="10" cy="12" r="1.5"/>
                    </svg>
                  </div>
                  <div style={{flex:2}}><Input placeholder="Phase Name" value={p.name} onChange={e => { const np = [...draft.phases]; np[pIdx].name = e.target.value; setDraft({...draft, phases: np}) }} /></div>
                  <div style={{flex:1}}><Input type="number" placeholder="Days" value={p.duration} onChange={e => { const np = [...draft.phases]; np[pIdx].duration = parseInt(e.target.value); setDraft({...draft, phases: np}) }} /></div>
                  <Button variant="ghost" size="sm" onClick={() => setDraft({...draft, phases: draft.phases.filter((_, i) => i !== pIdx)})}>✕</Button>
                </div>
                
                <div className={styles.phaseContent}>
                  <div className={styles.milestoneList}>
                    {p.milestones.map((m, mIdx) => (
                      <div key={m.id} className={styles.milestoneRow}>
                        <div style={{flex:1}}>
                          <Input placeholder="Milestone Name" value={m.name} onChange={e => { const np = [...draft.phases]; np[pIdx].milestones[mIdx].name = e.target.value; setDraft({...draft, phases: np}) }} />
                        </div>
                        <div 
                          className={`${styles.paymentToggle} ${m.triggersPayment ? styles.active : ''}`}
                          onClick={() => { const np = [...draft.phases]; np[pIdx].milestones[mIdx].triggersPayment = !m.triggersPayment; setDraft({...draft, phases: np}) }}
                        >
                          ₹ Triggers Payment
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => { const np = [...draft.phases]; np[pIdx].milestones = np[pIdx].milestones.filter((_, i) => i !== mIdx); setDraft({...draft, phases: np}) }}>✕</Button>
                      </div>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => addMilestone(pIdx)} style={{alignSelf:'flex-start'}}>+ Add Milestone</Button>
                </div>
              </div>
            ))}
            
            <Button variant="secondary" onClick={addPhase} style={{alignSelf:'flex-start'}}>+ Add Phase</Button>
          </div>

          <div className={styles.rightCol}>
            <div className={styles.sectionTitle}>Preview</div>
            <div className={styles.previewTimeline}>
              {draft.phases.length === 0 ? <div style={{color:'var(--color-text-muted)', fontSize:13}}>No phases added yet.</div> : null}
              {draft.phases.map(p => (
                <div key={p.id} className={styles.previewPhase}>
                  <div className={styles.previewPhaseName}>{p.name || 'Untitled Phase'}</div>
                  <div className={styles.previewDuration}>{p.duration || 0} days</div>
                  
                  {p.milestones.map(m => (
                    <div key={m.id} className={styles.previewMilestone}>
                      <span style={{color:'var(--color-border-strong)'}}>└</span> {m.name || 'Untitled Milestone'}
                      {m.triggersPayment && <span className={styles.previewMilestonePay}>₹ Payment</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
