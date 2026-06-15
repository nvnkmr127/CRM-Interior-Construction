import { useState, useEffect } from 'react'
import styles from './ConvertToProjectModal.module.css'
import { Modal, Button, Input, Select } from '../ui'
import { useToast } from '../../store/toastContext'

const PROJECT_TYPES = [
  { id: 'full_interior', icon: '🏠', label: 'Full Interior' },
  { id: 'modular_kitchen', icon: '🍳', label: 'Modular Kitchen' },
  { id: 'commercial', icon: '🏢', label: 'Commercial' },
  { id: 'turnkey', icon: '🔑', label: 'Turnkey' },
  { id: 'renovation', icon: '🔨', label: 'Renovation' }
]

export default function ConvertToProjectModal({ lead, isOpen, onClose, onConverted }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const [formData, setFormData] = useState({
    projectType: '',
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    projectName: '',
    pm: '',
    template: 'none',
    contractValue: ''
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isOpen && lead) {
      setStep(1)
      setFormData({
        projectType: '',
        clientName: lead.name || '',
        clientPhone: lead.phone || '',
        clientEmail: lead.email || '',
        projectName: lead.name ? `${lead.name.split(' ')[0]}'s Project` : '',
        pm: '',
        template: 'none',
        contractValue: ''
      })
      setErrors({})
    }
  }, [isOpen, lead])

  const handleNext = () => {
    setStep(2)
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.projectType) newErrors.projectType = 'Project type is required'
    if (!formData.pm) newErrors.pm = 'Project Manager is required'
    if (!formData.clientName) newErrors.clientName = 'Client name is required'
    if (!formData.projectName) newErrors.projectName = 'Project name is required'
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)

    // Mock API Call
    await new Promise(r => setTimeout(r, 800))
    
    toast.success('Project created! Lead marked as converted.')
    
    const newProject = {
      id: Date.now().toString(),
      ...formData
    }
    
    setLoading(false)
    onClose()
    if (onConverted) onConverted(newProject)
  }

  if (!isOpen || !lead) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Convert Lead to Project"
      size="lg"
      footer={
        step === 1 ? (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleNext}>Continue →</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Creating...' : 'Create Project →'}
            </Button>
          </>
        )
      }
    >
      <div className={styles.progressStrip}>
        <div className={`${styles.stepText} ${step >= 1 ? styles.active : ''}`}>Step 1</div>
        <div className={`${styles.stepDot} ${step >= 1 ? styles.active : ''}`} />
        <div className={`${styles.stepLine} ${step >= 2 ? styles.active : ''}`} />
        <div className={`${styles.stepDot} ${step >= 2 ? styles.active : ''}`} />
        <div className={`${styles.stepText} ${step >= 2 ? styles.active : ''}`}>Step 2</div>
      </div>

      <div className={styles.slideContainer}>
        {/* STEP 1 */}
        <div className={`${styles.slide} ${step === 1 ? styles.slideActive : styles.slideHiddenLeft}`}>
          <div className={styles.summaryCard}>
            <div style={{fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-text)'}}>
              Ready to convert this lead?
            </div>
            <p style={{color: 'var(--color-text-secondary)', marginTop: 8}}>
              This will create a new project linked to this lead, allowing you to manage tasks, phases, and billing.
            </p>
            
            <div className={styles.summaryGrid}>
              <div>
                <div className={styles.summaryLabel}>Name</div>
                <div className={styles.summaryValue}>{lead.name || '-'}</div>
              </div>
              <div>
                <div className={styles.summaryLabel}>Phone</div>
                <div className={styles.summaryValue}>{lead.phone || '-'}</div>
              </div>
              <div>
                <div className={styles.summaryLabel}>Source</div>
                <div className={styles.summaryValue}>{lead.source || '-'}</div>
              </div>
              <div>
                <div className={styles.summaryLabel}>Score</div>
                <div className={styles.summaryValue}>{lead.score || '-'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 2 */}
        <div className={`${styles.slide} ${step === 2 ? styles.slideActive : styles.slideHiddenRight}`}>
          <div className={styles.sectionTitle}>Project Type</div>
          <div className={styles.typeSelector}>
            {PROJECT_TYPES.map(type => (
              <div 
                key={type.id} 
                className={`${styles.typeCard} ${formData.projectType === type.id ? styles.selected : ''}`}
                onClick={() => {
                  setFormData({...formData, projectType: type.id})
                  if (errors.projectType) setErrors({...errors, projectType: null})
                }}
              >
                <div className={styles.typeIcon}>{type.icon}</div>
                <div className={styles.typeLabel}>{type.label}</div>
              </div>
            ))}
          </div>
          {errors.projectType && <div className={styles.errorMsg}>{errors.projectType}</div>}

          <div className={styles.grid} style={{marginTop: 24}}>
            <Input 
              label="Client Name *" 
              value={formData.clientName} 
              onChange={e => setFormData({...formData, clientName: e.target.value})} 
              error={errors.clientName}
            />
            <Input 
              label="Project Name *" 
              placeholder="e.g. Sharma Residence - Full Interior"
              value={formData.projectName} 
              onChange={e => setFormData({...formData, projectName: e.target.value})} 
              error={errors.projectName}
            />
            
            <Input 
              label="Client Phone" 
              value={formData.clientPhone} 
              onChange={e => setFormData({...formData, clientPhone: e.target.value})} 
            />
            <Input 
              label="Client Email" 
              value={formData.clientEmail} 
              onChange={e => setFormData({...formData, clientEmail: e.target.value})} 
            />

            <Select 
              label="Project Manager *" 
              options={[{value:'',label:'Select PM'}, {value:'u1',label:'Priya Sharma'}, {value:'u2',label:'Rahul Desai'}]}
              value={formData.pm}
              onChange={v => setFormData({...formData, pm: v})}
              error={errors.pm}
            />
            <Select 
              label="Template" 
              options={[{value:'none',label:'None (blank project)'}, {value:'t1',label:'Standard 3BHK Interior'}, {value:'t2',label:'Commercial Office Fit-out'}]}
              value={formData.template}
              onChange={v => setFormData({...formData, template: v})}
            />

            <div className={styles.fullWidth}>
              <Input 
                label="Estimated Contract Value (₹)" 
                type="number"
                placeholder="e.g. 500000"
                value={formData.contractValue} 
                onChange={e => setFormData({...formData, contractValue: e.target.value})} 
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
