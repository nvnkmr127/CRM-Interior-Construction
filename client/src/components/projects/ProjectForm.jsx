import { useState, useEffect } from 'react'
import styles from './ProjectForm.module.css'
import { Modal, Input, Select, Button, Textarea } from '../ui'
import { useToast } from '../../store/toastContext'
import { createProject, updateProject } from '../../api/projects'
import { useS3Upload } from '../../hooks/useS3Upload'

const PROJECT_TYPES = [
  { id: 'full_interior', icon: '🏠', label: 'Full Interior' },
  { id: 'modular_kitchen', icon: '🍳', label: 'Modular Kitchen' },
  { id: 'commercial', icon: '🏢', label: 'Commercial' },
  { id: 'turnkey', icon: '🔑', label: 'Turnkey' },
  { id: 'renovation', icon: '🔨', label: 'Renovation' }
]

export default function ProjectForm({ project, onSave, onClose, isOpen }) {
  const toast = useToast()
  const { uploadContract, uploading, progress } = useS3Upload()
  const [contractFile, setContractFile] = useState(null)
  
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
    bookingAmount: '',
    startDate: '',
    targetDate: '',
    template: 'none',
    agreementSignedBy: '',
    agreementSignedAt: '',
    agreementSignatureMethod: '',
    paymentTerms: ''
  })
  
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (project && isOpen) {
      setFormData({
        projectType: project.projectType || project.project_type || '',
        clientName: project.clientName || project.client_name || '',
        clientPhone: project.clientPhone || project.client_phone || '',
        clientEmail: project.clientEmail || project.client_email || '',
        siteAddress: project.siteAddress || project.site_address || '',
        projectName: project.projectName || project.name || '',
        pm: project.pm || project.pm_id || '',
        designer: project.designer || project.designer_id || '',
        contractValue: project.contractValue || project.contract_value || '',
        bookingAmount: project.bookingAmount || project.booking_amount || '',
        startDate: project.startDate || (project.start_date ? project.start_date.split('T')[0] : ''),
        targetDate: project.targetDate || (project.target_date ? project.target_date.split('T')[0] : ''),
        template: project.template || 'none',
        agreementSignedBy: project.agreementSignedBy || project.agreement_signed_by || '',
        agreementSignedAt: project.agreementSignedAt || (project.agreement_signed_at ? project.agreement_signed_at.split('T')[0] : ''),
        agreementSignatureMethod: project.agreementSignatureMethod || project.agreement_signature_method || '',
        paymentTerms: project.paymentTerms || project.payment_terms || ''
      })
      setContractFile(null)
      setErrors({})
    } else if (isOpen) {
      // Reset form on open if creating new
      setFormData({
        projectType: '', clientName: '', clientPhone: '', clientEmail: '',
        siteAddress: '', projectName: '', pm: '', designer: '', contractValue: '',
        bookingAmount: '', startDate: '', targetDate: '', template: 'none',
        agreementSignedBy: '', agreementSignedAt: '', agreementSignatureMethod: '',
        paymentTerms: ''
      })
      setContractFile(null)
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
    if (!project && !contractFile) newErrors.contractFile = 'Signed contract document is required'
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      let contractFields = {}
      if (!project) {
        const uploadedFile = await uploadContract({ file: contractFile })
        contractFields = {
          contract_file_key: uploadedFile.storageKey,
          contract_file_name: uploadedFile.fileName,
          contract_file_size: uploadedFile.fileSize,
          contract_file_mime: uploadedFile.mimeType
        }
      }

      const payload = {
        name: formData.projectName,
        type: formData.projectType,
        client_name: formData.clientName,
        client_phone: formData.clientPhone,
        client_email: formData.clientEmail,
        site_address: formData.siteAddress,
        pm_id: formData.pm || null,
        designer_id: formData.designer || null,
        contract_value: formData.contractValue ? Number(formData.contractValue) : null,
        booking_amount: formData.bookingAmount ? Number(formData.bookingAmount) : null,
        start_date: formData.startDate || null,
        target_date: formData.targetDate || null,
        template_id: formData.template !== 'none' ? formData.template : null,
        agreement_signed_by: formData.agreementSignedBy || null,
        agreement_signed_at: formData.agreementSignedAt || null,
        agreement_signature_method: formData.agreementSignatureMethod || null,
        payment_terms: formData.paymentTerms || null,
        ...contractFields
      }
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
          <div>
            <Input 
              label="Booking Amount (₹)" 
              type="number"
              placeholder="e.g. 50000"
              value={formData.bookingAmount} 
              onChange={e => setFormData({...formData, bookingAmount: e.target.value})} 
              disabled={!!project}
            />
          </div>
        </div>

        <div className={styles.fullWidth} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className={styles.datesGrid} style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
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

        <div className={styles.fullWidth} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
          <Input 
            label="Agreement Signed By" 
            value={formData.agreementSignedBy} 
            onChange={e => setFormData({...formData, agreementSignedBy: e.target.value})} 
          />
          <Input 
            label="Agreement Signed Date" 
            type="date"
            value={formData.agreementSignedAt} 
            onChange={e => setFormData({...formData, agreementSignedAt: e.target.value})} 
          />
          <Select 
            label="Signature Method" 
            options={[{value:'',label:'Select Method'}, {value:'digital',label:'Digital'}, {value:'physical',label:'Physical'}]}
            value={formData.agreementSignatureMethod}
            onChange={v => setFormData({...formData, agreementSignatureMethod: v})}
          />
        </div>

        <div className={`${styles.fullWidth} ${styles.datesGrid}`}>
          <Select 
            label="Template" 
            options={[{value:'none',label:'None (blank project)'}, {value:'t1',label:'Standard 3BHK Interior'}, {value:'t2',label:'Commercial Office Fit-out'}]}
            value={formData.template}
            onChange={v => setFormData({...formData, template: v})}
          />
          <Select 
            label="Payment Terms" 
            options={[
              {value:'',label:'Select Terms'}, 
              {value:'10_40_40_10',label:'10% - 40% - 40% - 10%'}, 
              {value:'30_30_30_10',label:'30% - 30% - 30% - 10%'}, 
              {value:'50_50',label:'50% - 50%'}
            ]}
            value={formData.paymentTerms}
            onChange={v => setFormData({...formData, paymentTerms: v})}
          />
        </div>

        {!project && (
          <div className={styles.fullWidth} style={{ marginTop: 16 }}>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Signed Contract Document *</label>
            <div className="flex items-center gap-4">
              <input 
                type="file" 
                accept=".pdf,.png,.jpg,.jpeg" 
                onChange={e => setContractFile(e.target.files[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
              {uploading && (
                <span className="text-xs text-blue-600 font-medium whitespace-nowrap">Uploading ({progress}%)...</span>
              )}
            </div>
            {errors.contractFile && <div className={styles.errorMsg} style={{ marginTop: 4 }}>{errors.contractFile}</div>}
            {contractFile && (
              <p className="text-xs text-gray-500 mt-1">Selected file: <span className="font-semibold text-gray-700">{contractFile.name}</span> ({(contractFile.size / 1024).toFixed(1)} KB)</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
