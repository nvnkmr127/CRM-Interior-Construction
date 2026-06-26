import { useState, useEffect } from 'react'
import styles from './ProjectForm.module.css'
import { Modal, Input, Select, Button } from '../ui'
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
    paymentTerms: '',
    flatNumber: '',
    floor: '',
    buildingName: '',
    street: '',
    city: '',
    pincode: '',
    landmark: '',
    latitude: '',
    longitude: '',
    builderName: '',
    societyName: '',
    reraId: '',
    nocStatus: 'pending',
    occupancyCertificateStatus: 'pending',
    propertyHandoverDate: '',
    contacts: [],
    measurements: [],
    carpetArea: '',
    builtUpArea: '',
    numberOfRooms: '',
    projectCategory: '',
    projectSubCategory: '',
    propertyType: '',
    propertyAge: '',
    renovationScope: '',
    segment: ''
  })
  
  const [errors, setErrors] = useState({})
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'co_owner',
    decision_authority: 'Influencer',
    relationship_notes: ''
  })
  const [newRoomMeasurement, setNewRoomMeasurement] = useState({
    room_name: '',
    length: '',
    width: '',
    height: '',
    area: '',
    unit: 'feet',
    notes: ''
  })

  const [newVendor, setNewVendor] = useState({
    vendor_name: '',
    scope_of_work: '',
    agreed_rate: '',
    payment_terms: '',
    status: 'pending'
  })

  const [newConsultant, setNewConsultant] = useState({
    name: '',
    role: 'structural_engineer',
    firm: '',
    email: '',
    phone: ''
  })

  const handleNewRoomChange = (field, value) => {
    setNewRoomMeasurement(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'length' || field === 'width') {
        const l = parseFloat(field === 'length' ? value : prev.length) || 0;
        const w = parseFloat(field === 'width' ? value : prev.width) || 0;
        if (l > 0 && w > 0) {
          updated.area = (l * w).toFixed(2);
        }
      }
      return updated;
    });
  }

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
        paymentTerms: project.paymentTerms || project.payment_terms || '',
        flatNumber: project.flat_number || project.flatNumber || '',
        floor: project.floor || '',
        buildingName: project.building_name || project.buildingName || '',
        street: project.street || '',
        city: project.city || '',
        pincode: project.pincode || '',
        landmark: project.landmark || '',
        latitude: project.latitude || '',
        longitude: project.longitude || '',
        builderName: project.builder_name || project.builderName || '',
        societyName: project.society_name || project.societyName || '',
        reraId: project.rera_id || project.reraId || '',
        nocStatus: project.noc_status || project.nocStatus || 'pending',
        occupancyCertificateStatus: project.occupancy_certificate_status || project.occupancyCertificateStatus || 'pending',
        propertyHandoverDate: project.propertyHandoverDate || (project.property_handover_date ? project.property_handover_date.split('T')[0] : ''),
        contacts: project.contacts || [],
        measurements: project.measurements || [],
        carpetArea: project.carpet_area || project.carpetArea || '',
        builtUpArea: project.built_up_area || project.builtUpArea || '',
        numberOfRooms: project.number_of_rooms || project.numberOfRooms || '',
        projectCategory: project.project_category || project.projectCategory || '',
        projectSubCategory: project.project_sub_category || project.projectSubCategory || '',
        propertyType: project.property_type || project.propertyType || '',
        propertyAge: project.property_age || project.propertyAge || '',
        renovationScope: project.renovation_scope || project.renovationScope || '',
        segment: project.segment || '',
        vendors: project.vendors || [],
        consultants: project.consultants || []
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
        paymentTerms: '', flatNumber: '', floor: '', buildingName: '', street: '',
        city: '', pincode: '', landmark: '', latitude: '', longitude: '',
        builderName: '', societyName: '', reraId: '', nocStatus: 'pending',
        occupancyCertificateStatus: 'pending', propertyHandoverDate: '',
        contacts: [], measurements: [], carpetArea: '', builtUpArea: '', numberOfRooms: '',
        projectCategory: '', projectSubCategory: '', propertyType: '', propertyAge: '',
        renovationScope: '', segment: '',
        vendors: [], consultants: []
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
        flat_number: formData.flatNumber || null,
        floor: formData.floor || null,
        building_name: formData.buildingName || null,
        street: formData.street || null,
        city: formData.city || null,
        pincode: formData.pincode || null,
        landmark: formData.landmark || null,
        latitude: formData.latitude ? Number(formData.latitude) : null,
        longitude: formData.longitude ? Number(formData.longitude) : null,
        builder_name: formData.builderName || null,
        society_name: formData.societyName || null,
        rera_id: formData.reraId || null,
        noc_status: formData.nocStatus || 'pending',
        occupancy_certificate_status: formData.occupancyCertificateStatus || 'pending',
        property_handover_date: formData.propertyHandoverDate || null,
        contacts: formData.contacts || [],
        carpet_area: formData.carpetArea ? Number(formData.carpetArea) : null,
        built_up_area: formData.builtUpArea ? Number(formData.builtUpArea) : null,
        number_of_rooms: formData.numberOfRooms ? Number(formData.numberOfRooms) : null,
        project_category: formData.projectCategory || null,
        project_sub_category: formData.projectSubCategory || null,
        property_type: formData.propertyType || null,
        property_age: formData.propertyAge || null,
        renovation_scope: formData.renovationScope || null,
        segment: formData.segment || null,
        measurements: formData.measurements || [],
        vendors: formData.vendors || [],
        consultants: formData.consultants || [],
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

        {/* Structured address fields */}
        <div className={styles.fullWidth}>
          <div className={styles.sectionTitle} style={{ marginBottom: 12 }}>Site Address Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <Input 
              label="Flat / Unit No" 
              placeholder="e.g. 502"
              value={formData.flatNumber} 
              onChange={e => setFormData({...formData, flatNumber: e.target.value})} 
            />
            <Input 
              label="Floor" 
              placeholder="e.g. 5"
              value={formData.floor} 
              onChange={e => setFormData({...formData, floor: e.target.value})} 
            />
            <Input 
              label="Building Name" 
              placeholder="e.g. Oakridge Heights"
              value={formData.buildingName} 
              onChange={e => setFormData({...formData, buildingName: e.target.value})} 
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <Input 
              label="Street Address" 
              placeholder="e.g. 1st Cross, Banjara Hills"
              value={formData.street} 
              onChange={e => setFormData({...formData, street: e.target.value})} 
            />
            <Input 
              label="Landmark" 
              placeholder="e.g. Opposite ICICI Bank"
              value={formData.landmark} 
              onChange={e => setFormData({...formData, landmark: e.target.value})} 
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <Input 
              label="City" 
              placeholder="e.g. Hyderabad"
              value={formData.city} 
              onChange={e => setFormData({...formData, city: e.target.value})} 
            />
            <Input 
              label="Pincode" 
              placeholder="e.g. 500034"
              value={formData.pincode} 
              onChange={e => setFormData({...formData, pincode: e.target.value})} 
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', alignItems: 'end' }}>
            <Input 
              label="Latitude" 
              placeholder="e.g. 17.4126"
              value={formData.latitude} 
              onChange={e => setFormData({...formData, latitude: e.target.value})} 
            />
            <Input 
              label="Longitude" 
              placeholder="e.g. 78.4354"
              value={formData.longitude} 
              onChange={e => setFormData({...formData, longitude: e.target.value})} 
            />
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                if (!navigator.geolocation) {
                  toast.error('Geolocation is not supported by your browser')
                  return
                }
                navigator.geolocation.getCurrentPosition(
                  position => {
                    setFormData(prev => ({
                      ...prev,
                      latitude: position.coords.latitude.toFixed(6),
                      longitude: position.coords.longitude.toFixed(6)
                    }))
                    toast.success('Coordinates retrieved successfully!')
                  },
                  error => {
                    toast.error('Failed to get location: ' + error.message)
                  }
                )
              }} 
              style={{ height: '38px', padding: '0 12px' }}
            >
              📍 Get Location
            </Button>
          </div>
        </div>

        {/* Site, Builder & Society Details */}
        <div className={styles.fullWidth} style={{ marginTop: 8 }}>
          <div className={styles.sectionTitle} style={{ marginBottom: 12 }}>Site, Builder & NOC Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <Input 
              label="Builder Name" 
              placeholder="e.g. Prestige Group"
              value={formData.builderName} 
              onChange={e => setFormData({...formData, builderName: e.target.value})} 
            />
            <Input 
              label="Society Name" 
              placeholder="e.g. Prestige Lakeside Habitat"
              value={formData.societyName} 
              onChange={e => setFormData({...formData, societyName: e.target.value})} 
            />
            <Input 
              label="RERA ID" 
              placeholder="e.g. PRM/KA/RERA/..."
              value={formData.reraId} 
              onChange={e => setFormData({...formData, reraId: e.target.value})} 
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <Select 
              label="Builder NOC Status" 
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'not_required', label: 'Not Required' }
              ]}
              value={formData.nocStatus}
              onChange={v => setFormData({...formData, nocStatus: v})}
            />
            <Select 
              label="Occupancy Certificate" 
              options={[
                { value: 'pending', label: 'Pending / In Progress' },
                { value: 'received', label: 'Received' },
                { value: 'not_required', label: 'Not Required' }
              ]}
              value={formData.occupancyCertificateStatus}
              onChange={v => setFormData({...formData, occupancyCertificateStatus: v})}
            />
            <Input 
              label="Property Handover Date" 
              type="date"
              value={formData.propertyHandoverDate} 
              onChange={e => setFormData({...formData, propertyHandoverDate: e.target.value})} 
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <Input 
              label="Carpet Area (sq ft)" 
              type="number"
              placeholder="e.g. 1200"
              value={formData.carpetArea} 
              onChange={e => setFormData({...formData, carpetArea: e.target.value})} 
            />
            <Input 
              label="Built-up Area (sq ft)" 
              type="number"
              placeholder="e.g. 1500"
              value={formData.builtUpArea} 
              onChange={e => setFormData({...formData, builtUpArea: e.target.value})} 
            />
            <Input 
              label="Number of Rooms" 
              type="number"
              placeholder="e.g. 4"
              value={formData.numberOfRooms} 
              onChange={e => setFormData({...formData, numberOfRooms: e.target.value})} 
            />
          </div>
        </div>

        {/* Project Classification & Nature */}
        <div className={styles.fullWidth} style={{ marginTop: 8 }}>
          <div className={styles.sectionTitle} style={{ marginBottom: 12 }}>Project Classification & Nature</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <Select 
              label="Project Category" 
              options={[
                { value: '', label: 'Select Category' },
                { value: 'residential', label: 'Residential' },
                { value: 'commercial', label: 'Commercial' },
                { value: 'other', label: 'Other' }
              ]}
              value={formData.projectCategory}
              onChange={v => setFormData({...formData, projectCategory: v})}
            />
            <Select 
              label="Project Sub-Category" 
              options={[
                { value: '', label: 'Select Sub-Category' },
                { value: 'apartment', label: 'Apartment' },
                { value: 'villa', label: 'Villa' },
                { value: 'independent_house', label: 'Independent House' },
                { value: 'office', label: 'Office' },
                { value: 'retail', label: 'Retail' },
                { value: 'hospitality', label: 'Hospitality' },
                { value: 'other', label: 'Other' }
              ]}
              value={formData.projectSubCategory}
              onChange={v => setFormData({...formData, projectSubCategory: v})}
            />
            <Select 
              label="Ownership Type" 
              options={[
                { value: '', label: 'Select Ownership' },
                { value: 'owned', label: 'Owned' },
                { value: 'rented', label: 'Rented' }
              ]}
              value={formData.propertyType}
              onChange={v => setFormData({...formData, propertyType: v})}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <Select 
              label="Property Age" 
              options={[
                { value: '', label: 'Select Property Age' },
                { value: 'new', label: 'New / Under Construction' },
                { value: '1-5_years', label: '1 - 5 Years' },
                { value: '5-10_years', label: '5 - 10 Years' },
                { value: '10+_years', label: '10+ Years' }
              ]}
              value={formData.propertyAge}
              onChange={v => setFormData({...formData, propertyAge: v})}
            />
            <Select 
              label="Renovation Scope" 
              options={[
                { value: '', label: 'Select Renovation Scope' },
                { value: 'full', label: 'Full Renovation' },
                { value: 'partial', label: 'Partial Renovation' },
                { value: 'none', label: 'New Handover Fit-out (None)' }
              ]}
              value={formData.renovationScope}
              onChange={v => setFormData({...formData, renovationScope: v})}
            />
            <Select 
              label="Market Segment" 
              options={[
                { value: '', label: 'Select Segment' },
                { value: 'budget', label: 'Budget' },
                { value: 'standard', label: 'Standard' },
                { value: 'premium', label: 'Premium' },
                { value: 'luxury', label: 'Luxury' }
              ]}
              value={formData.segment}
              onChange={v => setFormData({...formData, segment: v})}
            />
          </div>
        </div>

        {/* Site Measurements & Room Dimensions */}
        <div className={styles.fullWidth} style={{ marginTop: 8 }}>
          <div className={styles.sectionTitle} style={{ marginBottom: 12 }}>Site Measurements & Room Dimensions</div>
          
          {/* Render list of added room measurements */}
          {formData.measurements && formData.measurements.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {formData.measurements.map((room, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-hover, #f8fafc)',
                  border: '1px solid var(--color-border)'
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{room.room_name}</span>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                      Dimensions: <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{room.length} x {room.width} x {room.height} {room.unit}</span>
                      {room.area && <> | Area: <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{room.area} sq {room.unit}</span></>}
                      {room.notes && ` | Notes: ${room.notes}`}
                    </div>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => {
                      const updated = formData.measurements.filter((_, i) => i !== idx);
                      setFormData({ ...formData, measurements: updated });
                    }}
                    style={{ color: 'var(--color-danger)', padding: '4px 8px' }}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '16px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: '16px' }}>
              No room measurements recorded yet.
            </div>
          )}

          {/* Form to add a new room measurement */}
          <div style={{
            background: 'var(--color-surface, #fff)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Add Room Measurement
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px' }}>
              <Input 
                label="Room Name" 
                placeholder="e.g. Master Bedroom"
                value={newRoomMeasurement.room_name}
                onChange={e => handleNewRoomChange('room_name', e.target.value)}
              />
              <Input 
                label="Length" 
                type="number"
                placeholder="e.g. 12"
                value={newRoomMeasurement.length}
                onChange={e => handleNewRoomChange('length', e.target.value)}
              />
              <Input 
                label="Width" 
                type="number"
                placeholder="e.g. 10"
                value={newRoomMeasurement.width}
                onChange={e => handleNewRoomChange('width', e.target.value)}
              />
              <Input 
                label="Height" 
                type="number"
                placeholder="e.g. 9.5"
                value={newRoomMeasurement.height}
                onChange={e => handleNewRoomChange('height', e.target.value)}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: '12px', alignItems: 'end' }}>
              <Input 
                label="Area" 
                type="number"
                placeholder="e.g. 120"
                value={newRoomMeasurement.area}
                onChange={e => handleNewRoomChange('area', e.target.value)}
              />
              <Select 
                label="Unit" 
                options={[
                  { value: 'feet', label: 'Feet' },
                  { value: 'meters', label: 'Meters' }
                ]}
                value={newRoomMeasurement.unit}
                onChange={v => handleNewRoomChange('unit', v)}
              />
              <Input 
                label="Notes" 
                placeholder="e.g. Extra point socket required on east wall"
                value={newRoomMeasurement.notes}
                onChange={e => handleNewRoomChange('notes', e.target.value)}
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  if (!newRoomMeasurement.room_name || newRoomMeasurement.room_name.trim() === '') {
                    toast.error('Room name is required');
                    return;
                  }
                  setFormData(prev => ({
                    ...prev,
                    measurements: [...(prev.measurements || []), { 
                      room_name: newRoomMeasurement.room_name.trim(),
                      length: newRoomMeasurement.length ? Number(newRoomMeasurement.length) : 0,
                      width: newRoomMeasurement.width ? Number(newRoomMeasurement.width) : 0,
                      height: newRoomMeasurement.height ? Number(newRoomMeasurement.height) : 0,
                      area: newRoomMeasurement.area ? Number(newRoomMeasurement.area) : 0,
                      unit: newRoomMeasurement.unit,
                      notes: newRoomMeasurement.notes ? newRoomMeasurement.notes.trim() : ''
                    }]
                  }));
                  setNewRoomMeasurement({
                    room_name: '',
                    length: '',
                    width: '',
                    height: '',
                    area: '',
                    unit: 'feet',
                    notes: ''
                  });
                }}
                style={{ height: '38px', padding: '0 16px' }}
              >
                Add Room
              </Button>
            </div>
          </div>
        </div>

        {/* Project Stakeholders */}
        <div className={styles.fullWidth} style={{ marginTop: 8 }}>
          <div className={styles.sectionTitle} style={{ marginBottom: 12 }}>Project Stakeholders & Contacts</div>
          
          {/* Render list of added contacts */}
          {formData.contacts && formData.contacts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {formData.contacts.map((contact, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-hover, #f8fafc)',
                  border: '1px solid var(--color-border)'
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{contact.name}</span>
                    <span style={{
                      marginLeft: '8px',
                      padding: '2px 6px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      background: 'var(--color-accent-bg, #eff6ff)',
                      color: 'var(--color-accent, #3b82f6)',
                      fontWeight: 500,
                      textTransform: 'capitalize'
                    }}>
                      {contact.role ? contact.role.replace(/_/g, ' ') : ''}
                    </span>
                    <span style={{
                      marginLeft: '6px',
                      padding: '2px 6px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      background: 'var(--color-success-bg, #f0fdf4)',
                      color: 'var(--color-success, #22c55e)',
                      fontWeight: 500
                    }}>
                      {contact.decision_authority}
                    </span>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                      {contact.phone && `📞 ${contact.phone}`} {contact.email && ` | ✉️ ${contact.email}`} {contact.relationship_notes && ` | 📝 ${contact.relationship_notes}`}
                    </div>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => {
                      const updated = formData.contacts.filter((_, i) => i !== idx);
                      setFormData({ ...formData, contacts: updated });
                    }}
                    style={{ color: 'var(--color-danger)', padding: '4px 8px' }}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '16px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: '16px' }}>
              No additional stakeholders added yet.
            </div>
          )}

          {/* Form to add a new contact */}
          <div style={{
            background: 'var(--color-surface, #fff)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Add Stakeholder / Contact
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
              <Input 
                label="Full Name" 
                placeholder="e.g. John Doe"
                value={newContact.name}
                onChange={e => setNewContact({...newContact, name: e.target.value})}
              />
              <Input 
                label="Phone" 
                placeholder="e.g. 9876543210"
                value={newContact.phone}
                onChange={e => setNewContact({...newContact, phone: e.target.value})}
              />
              <Input 
                label="Email" 
                type="email"
                placeholder="e.g. john@example.com"
                value={newContact.email}
                onChange={e => setNewContact({...newContact, email: e.target.value})}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: '12px', alignItems: 'end' }}>
              <Select 
                label="Role" 
                options={[
                  { value: 'co_owner', label: 'Co-owner' },
                  { value: 'spouse', label: 'Spouse' },
                  { value: 'architect', label: 'Architect' },
                  { value: 'builder_representative', label: 'Builder Representative' },
                  { value: 'legal', label: 'Legal Representative' },
                  { value: 'other', label: 'Other' }
                ]}
                value={newContact.role}
                onChange={v => setNewContact({...newContact, role: v})}
              />
              <Select 
                label="Decision Power" 
                options={[
                  { value: 'Primary', label: 'Primary Decision Maker' },
                  { value: 'Influencer', label: 'Influencer' },
                  { value: 'Consultant', label: 'Consultant' }
                ]}
                value={newContact.decision_authority}
                onChange={v => setNewContact({...newContact, decision_authority: v})}
              />
              <Input 
                label="Relationship Notes" 
                placeholder="e.g. Architect coordinating design signoffs"
                value={newContact.relationship_notes}
                onChange={e => setNewContact({...newContact, relationship_notes: e.target.value})}
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  if (!newContact.name || newContact.name.trim() === '') {
                    toast.error('Contact name is required');
                    return;
                  }
                  setFormData(prev => ({
                    ...prev,
                    contacts: [...(prev.contacts || []), { ...newContact, name: newContact.name.trim() }]
                  }));
                  setNewContact({
                    name: '',
                    phone: '',
                    email: '',
                    role: 'co_owner',
                    decision_authority: 'Influencer',
                    relationship_notes: ''
                  });
                }}
                style={{ height: '38px', padding: '0 16px' }}
              >
                Add Stakeholder
              </Button>
            </div>
          </div>
        </div>

        {/* Project Vendors */}
        <div className={styles.fullWidth} style={{ marginTop: 8 }}>
          <div className={styles.sectionTitle} style={{ marginBottom: 12 }}>Project Vendors Engagement</div>
          
          {/* Render list of added vendors */}
          {formData.vendors && formData.vendors.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {formData.vendors.map((vendor, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-hover, #f8fafc)',
                  border: '1px solid var(--color-border)'
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{vendor.vendor_name}</span>
                    <span style={{
                      marginLeft: '8px',
                      padding: '2px 6px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      background: 'var(--color-accent-bg, #eff6ff)',
                      color: 'var(--color-accent, #3b82f6)',
                      fontWeight: 500,
                      textTransform: 'capitalize'
                    }}>
                      Scope: {vendor.scope_of_work || 'Not specified'}
                    </span>
                    <span style={{
                      marginLeft: '6px',
                      padding: '2px 6px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      background: 'var(--color-success-bg, #f0fdf4)',
                      color: 'var(--color-success, #22c55e)',
                      fontWeight: 500
                    }}>
                      ₹{vendor.agreed_rate || '0'}
                    </span>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                      Status: <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{vendor.status}</span> {vendor.payment_terms && ` | Payment Terms: ${vendor.payment_terms}`}
                    </div>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => {
                      const updated = formData.vendors.filter((_, i) => i !== idx);
                      setFormData({ ...formData, vendors: updated });
                    }}
                    style={{ color: 'var(--color-danger)', padding: '4px 8px' }}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '16px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: '16px' }}>
              No vendors assigned to this project yet.
            </div>
          )}

          {/* Form to add a new vendor */}
          <div style={{
            background: 'var(--color-surface, #fff)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Add Vendor Engagement
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '12px' }}>
              <Input 
                label="Vendor Name" 
                placeholder="e.g. Balaji Marbles"
                value={newVendor.vendor_name}
                onChange={e => setNewVendor({...newVendor, vendor_name: e.target.value})}
              />
              <Input 
                label="Scope of Work" 
                placeholder="e.g. Marble laying and polishing"
                value={newVendor.scope_of_work}
                onChange={e => setNewVendor({...newVendor, scope_of_work: e.target.value})}
              />
              <Input 
                label="Agreed Rate / Value (₹)" 
                type="number"
                placeholder="e.g. 75000"
                value={newVendor.agreed_rate}
                onChange={e => setNewVendor({...newVendor, agreed_rate: e.target.value})}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr auto', gap: '12px', alignItems: 'end' }}>
              <Input 
                label="Agreed Payment Terms" 
                placeholder="e.g. 30% advance, 40% mid-way, 30% signoff"
                value={newVendor.payment_terms}
                onChange={e => setNewVendor({...newVendor, payment_terms: e.target.value})}
              />
              <Select 
                label="Engagement Status" 
                options={[
                  { value: 'pending', label: 'Pending / Negotiating' },
                  { value: 'active', label: 'Active' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'terminated', label: 'Terminated' }
                ]}
                value={newVendor.status}
                onChange={v => setNewVendor({...newVendor, status: v})}
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  if (!newVendor.vendor_name || newVendor.vendor_name.trim() === '') {
                    toast.error('Vendor name is required');
                    return;
                  }
                  setFormData(prev => ({
                    ...prev,
                    vendors: [...(prev.vendors || []), { ...newVendor, vendor_name: newVendor.vendor_name.trim() }]
                  }));
                  setNewVendor({
                    vendor_name: '',
                    scope_of_work: '',
                    agreed_rate: '',
                    payment_terms: '',
                    status: 'pending'
                  });
                }}
                style={{ height: '38px', padding: '0 16px' }}
              >
                Add Vendor
              </Button>
            </div>
          </div>
        </div>

        {/* Project Consultants */}
        <div className={styles.fullWidth} style={{ marginTop: 8 }}>
          <div className={styles.sectionTitle} style={{ marginBottom: 12 }}>External Consultants Assigned</div>
          
          {/* Render list of added consultants */}
          {formData.consultants && formData.consultants.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {formData.consultants.map((consultant, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-hover, #f8fafc)',
                  border: '1px solid var(--color-border)'
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{consultant.name}</span>
                    <span style={{
                      marginLeft: '8px',
                      padding: '2px 6px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      background: 'var(--color-accent-bg, #eff6ff)',
                      color: 'var(--color-accent, #3b82f6)',
                      fontWeight: 500,
                      textTransform: 'capitalize'
                    }}>
                      {consultant.role ? consultant.role.replace(/_/g, ' ') : ''}
                    </span>
                    {consultant.firm && (
                      <span style={{ marginLeft: '6px', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        Firm: {consultant.firm}
                      </span>
                    )}
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                      {consultant.phone && `📞 ${consultant.phone}`} {consultant.email && ` | ✉️ ${consultant.email}`}
                    </div>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => {
                      const updated = formData.consultants.filter((_, i) => i !== idx);
                      setFormData({ ...formData, consultants: updated });
                    }}
                    style={{ color: 'var(--color-danger)', padding: '4px 8px' }}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '16px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: '16px' }}>
              No external consultants assigned to this project yet.
            </div>
          )}

          {/* Form to add a new consultant */}
          <div style={{
            background: 'var(--color-surface, #fff)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Assign Consultant
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
              <Input 
                label="Consultant Name" 
                placeholder="e.g. Dr. H. C. Verma"
                value={newConsultant.name}
                onChange={e => setNewConsultant({...newConsultant, name: e.target.value})}
              />
              <Input 
                label="Firm Name" 
                placeholder="e.g. Verma Structural Consultants"
                value={newConsultant.firm}
                onChange={e => setNewConsultant({...newConsultant, firm: e.target.value})}
              />
              <Select 
                label="Consultant Role" 
                options={[
                  { value: 'structural_engineer', label: 'Structural Engineer' },
                  { value: 'mep_consultant', label: 'MEP Consultant' },
                  { value: 'lighting_designer', label: 'Lighting Designer' },
                  { value: 'landscape_consultant', label: 'Landscape Consultant' },
                  { value: 'other', label: 'Other Special Consultant' }
                ]}
                value={newConsultant.role}
                onChange={v => setNewConsultant({...newConsultant, role: v})}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
              <Input 
                label="Phone Number" 
                placeholder="e.g. 9876543210"
                value={newConsultant.phone}
                onChange={e => setNewConsultant({...newConsultant, phone: e.target.value})}
              />
              <Input 
                label="Email Address" 
                type="email"
                placeholder="e.g. consultant@firm.com"
                value={newConsultant.email}
                onChange={e => setNewConsultant({...newConsultant, email: e.target.value})}
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  if (!newConsultant.name || newConsultant.name.trim() === '') {
                    toast.error('Consultant name is required');
                    return;
                  }
                  setFormData(prev => ({
                    ...prev,
                    consultants: [...(prev.consultants || []), { ...newConsultant, name: newConsultant.name.trim() }]
                  }));
                  setNewConsultant({
                    name: '',
                    role: 'structural_engineer',
                    firm: '',
                    email: '',
                    phone: ''
                  });
                }}
                style={{ height: '38px', padding: '0 16px' }}
              >
                Add Consultant
              </Button>
            </div>
          </div>
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
