import { useState, useEffect } from 'react'
import styles from './ProjectForm.module.css'
import { Modal, Input, Select, Button, Textarea } from '../ui'
import { useToast } from '../../store/toastContext'
import { createProject, updateProject } from '../../api/projects'

const PROJECT_TYPES = [
  { id: 'full_interior', icon: '🏠', label: 'Full Interior' },
  { id: 'modular_kitchen', icon: '🍳', label: 'Modular Kitchen' },
  { id: 'commercial', icon: '🏢', label: 'Commercial' },
  { id: 'turnkey', icon: '🔑', label: 'Turnkey' },
  { id: 'renovation', icon: '🔨', label: 'Renovation' }
]

export default function ProjectForm({ project, onSave, onClose, isOpen }) {
  const toast = useToast()
  
  const [formData, setFormData] = useState({
    projectType: '',
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    siteAddress: '',
    projectName: '',
    pm: '',
    designer: '',
    contractValue: '',
    startDate: '',
    targetDate: '',
    template: 'none'
  })
  
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (project && isOpen) {
      setFormData({
        projectType: project.projectType || '',
        clientName: project.clientName || '',
        clientPhone: project.clientPhone || '',
        clientEmail: project.clientEmail || '',
        siteAddress: project.siteAddress || '',
        projectName: project.projectName || '',
        pm: project.pm || '',
        designer: project.designer || '',
        contractValue: project.contractValue || '',
        startDate: project.startDate || '',
        targetDate: project.targetDate || '',
        template: project.template || 'none'
      })
      setErrors({})
    } else if (isOpen) {
      // Reset form on open if creating new
      setFormData({
        projectType: '', clientName: '', clientPhone: '', clientEmail: '',
        siteAddress: '', projectName: '', pm: '', designer: '', contractValue: '',
        startDate: '', targetDate: '', template: 'none'
      })
      setErrors({})
    }
  }, [project, isOpen])

  const validate = () => {
    const newErrors = {}
    if (!formData.projectType) newErrors.projectType = 'Project type is required'
    if (!formData.clientName || formData.clientName.length < 2) newErrors.clientName = 'Valid client name required'
    if (!formData.projectName || formData.projectName.length < 3) newErrors.projectName = 'Project name must be at least 3 chars'
    if (formData.clientPhone && formData.clientPhone.replace(/\D/g, '').length < 10) newErrors.clientPhone = 'Valid 10-digit phone required'
    if (formData.clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.clientEmail)) newErrors.clientEmail = 'Valid email required'
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    const payload = {
      name: formData.projectName,
      type: formData.projectType,
      client_name: formData.clientName,
      client_phone: formData.clientPhone,
      client_email: formData.clientEmail,
      site_address: formData.siteAddress,
      pm_id: formData.pm || null,
      designer_id: formData.designer || null,
      value: formData.contractValue ? Number(formData.contractValue) : null,
      start_date: formData.startDate || null,
      target_date: formData.targetDate || null,
      template_id: formData.template !== 'none' ? formData.template : null,
    }

    try {
      if (project) {
        await updateProject(project.id, payload)
        toast.success('Project updated')
      } else {
        await createProject(payload)
        toast.success(`Project created: ${formData.projectName}`)
      }
      onSave && onSave()
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to save project')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={project ? 'Edit Project' : 'New Project'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit}>{project ? 'Save Changes' : 'Create Project'}</Button>
        </>
      }
    >
      <div className={styles.sectionTitle} style={{marginTop: 0}}>Project Type</div>
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

      <div className={styles.sectionTitle}>Details</div>
      <div className={styles.grid}>
        {/* Left Col */}
        <div>
          <Input 
            label="Client Name *" 
            value={formData.clientName} 
            onChange={e => setFormData({...formData, clientName: e.target.value})} 
            error={errors.clientName}
          />
          <div style={{ marginTop: 16 }}>
            <Input 
              label="Client Phone" 
              placeholder="e.g. 98765 43210" 
              value={formData.clientPhone} 
              onChange={e => setFormData({...formData, clientPhone: e.target.value})}
              error={errors.clientPhone}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <Input 
              label="Client Email" 
              type="email" 
              value={formData.clientEmail} 
              onChange={e => setFormData({...formData, clientEmail: e.target.value})}
              error={errors.clientEmail}
            />
          </div>
        </div>

        {/* Right Col */}
        <div>
          <Input 
            label="Project Name *" 
            placeholder="e.g. Sharma 3BHK - Banjara Hills"
            value={formData.projectName} 
            onChange={e => setFormData({...formData, projectName: e.target.value})} 
            error={errors.projectName}
          />
          <div style={{ marginTop: 16 }}>
            <Select 
              label="Project Manager" 
              options={[{value:'',label:'Select PM'}, {value:'u1',label:'Priya Sharma'}, {value:'u2',label:'Rahul Desai'}]}
              value={formData.pm}
              onChange={v => setFormData({...formData, pm: v})}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <Select 
              label="Designer" 
              options={[{value:'',label:'Select Designer'}, {value:'u1',label:'Priya Sharma'}, {value:'u2',label:'Rahul Desai'}]}
              value={formData.designer}
              onChange={v => setFormData({...formData, designer: v})}
            />
          </div>
        </div>

        {/* Full width row spanning */}
        <div className={styles.fullWidth}>
          <Textarea 
            label="Site Address"
            value={formData.siteAddress}
            onChange={e => setFormData({...formData, siteAddress: e.target.value})}
            rows={3}
          />
        </div>

        <div className={styles.fullWidth} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <Input 
              label="Contract Value (₹)" 
              type="number"
              placeholder="e.g. 500000"
              value={formData.contractValue} 
              onChange={e => setFormData({...formData, contractValue: e.target.value})} 
              error={errors.contractValue}
            />
          </div>
          <div className={styles.datesGrid}>
            <Input 
              label="Start Date" 
              type="date"
              value={formData.startDate} 
              onChange={e => setFormData({...formData, startDate: e.target.value})} 
            />
            <Input 
              label="Target Date" 
              type="date"
              value={formData.targetDate} 
              onChange={e => setFormData({...formData, targetDate: e.target.value})} 
            />
          </div>
        </div>

        <div className={styles.fullWidth}>
          <Select 
            label="Template" 
            options={[{value:'none',label:'None (blank project)'}, {value:'t1',label:'Standard 3BHK Interior'}, {value:'t2',label:'Commercial Office Fit-out'}]}
            value={formData.template}
            onChange={v => setFormData({...formData, template: v})}
          />
        </div>
      </div>
    </Modal>
  )
}
