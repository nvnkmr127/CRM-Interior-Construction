import React, { useState, useEffect } from 'react';
import { Modal, Input, Button } from '../ui';
import api from '../../api/axios';
import { createLead, updateLead } from '../../api/leads';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../store/toastContext';
import { validators, run } from '../../utils/validators';
import styles from './LeadForm.module.css';

export default function LeadForm({ lead, onSave, onClose }) {
  const isEdit = !!lead;
  const toast = useToast();
  const [step, setStep] = useState(1);
  const totalSteps = 3;
  
  const { values, errors, touched, handleChange, handleBlur, validateAll, isValid, setValues } = useForm({
    name: lead?.name || '',
    phone: lead?.phone || '',
    email: lead?.email || '',
    source: lead?.source || '',
    stageId: lead?.stage_id || '',
    assigneeId: lead?.assignee_id || '',
    notes: lead?.notes || '',
    custom_fields: lead?.custom_fields || {},
    builder_name: lead?.builder_name || '',
    possession_date: lead?.possession_date ? lead.possession_date.substring(0, 10) : '',
    house_status: lead?.house_status || '',
    loan_approved: lead?.loan_approved || false,
    interior_style: lead?.interior_style || '',
    material_preference: lead?.material_preference || '',
    preferred_communication: lead?.preferred_communication || '',
    preferred_language: lead?.preferred_language || '',
    referral_source: lead?.referral_source || ''
  }, {
    name: run(validators.required('Name'), validators.minLen(2, 'Name')),
    phone: run(validators.required('Phone'), validators.phone),
    email: validators.email
  });

  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);
  const [customFieldsConfig, setCustomFieldsConfig] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/config/lead-stages').catch(()=>({data:{data:[]}})),
      api.get('/config/custom-fields?entity=lead').catch(()=>({data:{data:[]}})),
      api.get('/users').catch(()=>({data:{data:[]}}))
    ]).then(([sRes, fRes, uRes]) => {
      const fetchedStages = sRes.data?.data || [];
      setStages(fetchedStages);
      setCustomFieldsConfig(fRes.data?.data || []);
      setUsers(uRes.data?.data || []);
      
      if (!isEdit && fetchedStages.length > 0 && !values.stageId) {
        setValues(prev => ({ ...prev, stageId: fetchedStages[0].id }));
      }
    });
  }, [isEdit, values.stageId, setValues]);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    handleChange(name, type === 'checkbox' ? checked : value);
  };
  const onBlur = (e) => handleBlur(e.target.name);

  const handleNext = () => {
    // Add simple validation for current step before proceeding if needed
    if (step === 1 && (!values.name || !values.phone)) {
      toast.error('Name and Phone are required');
      return;
    }
    if (step < totalSteps) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!validateAll()) {
      toast.error('Please check the form for validation errors');
      return;
    }

    try {
      const payload = { ...values };
      if (!payload.stageId) delete payload.stageId;
      if (!payload.assigneeId) delete payload.assigneeId;
      if (!payload.source) delete payload.source;

      const res = isEdit 
        ? await updateLead(lead.id, payload)
        : await createLead(payload);
        
      if (res.success) {
        const assignedUserName = users.find(u => u.id === values.assigneeId)?.name || 'Unassigned';
        toast.success(isEdit ? 'Lead updated successfully' : `Lead created and assigned to ${assignedUserName}`);
        onSave && onSave(res.data);
        onClose();
      }
    } catch (err) {
      const message = err.response?.data?.error?.message || err.message || 'An unexpected error occurred while saving the lead.';
      toast.error(message);
    }
  };

  const isSubmitDisabled = !isValid;

  const handleClose = () => {
    if (Object.keys(touched).length > 0) {
      if (!window.confirm("You have unsaved changes. Are you sure you want to discard them?")) {
        return;
      }
    }
    onClose();
  };

  return (
    <Modal isOpen onClose={handleClose} size="lg">
      <div className={styles.formWrap}>
        <div className={styles.header}>
          <div className={styles.title}>{isEdit ? 'Edit Lead' : 'New Lead'}</div>
          {/* Step Indicator */}
          <div className="flex items-center gap-2 mt-4 mb-2">
            {[1, 2, 3].map(s => (
              <React.Fragment key={s}>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${step === s ? 'bg-blue-600 text-white' : step > s ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {step > s ? '✓' : s}
                </div>
                {s < 3 && <div className={`flex-1 h-1 rounded ${step > s ? 'bg-green-500' : 'bg-gray-100'}`} />}
              </React.Fragment>
            ))}
          </div>
          <div className="text-xs text-gray-500 font-medium text-center">
            {step === 1 && 'Contact Details'}
            {step === 2 && 'Property & Qualification'}
            {step === 3 && 'Assignment & Notes'}
          </div>
        </div>

        <div className={styles.body}>
          {/* STEP 1: Contact Details */}
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <Input 
                label="Name *" required 
                name="name" value={values.name} 
                onChange={onChange} onBlur={onBlur}
                error={touched.name && errors.name}
              />
              <Input 
                label="Phone *" required 
                name="phone" value={values.phone} 
                onChange={onChange} onBlur={onBlur}
                error={touched.phone && errors.phone}
              />
              <Input 
                label="Email" 
                name="email" value={values.email} 
                onChange={onChange} onBlur={onBlur}
                error={touched.email && errors.email}
              />
              
              <div>
                <label style={{fontSize: 'var(--text-sm)', fontWeight: 500, display: 'block', marginBottom: 'var(--space-1)'}}>Source</label>
                <select name="source" value={values.source} onChange={onChange} style={{width: '100%', padding: '8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)'}}>
                  <option value="">Select source</option>
                  <option value="Facebook">Facebook</option>
                  <option value="IndiaMART">IndiaMART</option>
                  <option value="Referral">Referral</option>
                  <option value="Website">Website</option>
                  <option value="Direct">Direct</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          )}

          {/* STEP 3: Assignment & Notes */}
          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <label style={{fontSize: 'var(--text-sm)', fontWeight: 500, display: 'block', marginBottom: 'var(--space-1)'}}>Stage</label>
                <select name="stageId" value={values.stageId} onChange={onChange} style={{width: '100%', padding: '8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)'}}>
                  <option value="">Select stage</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{fontSize: 'var(--text-sm)', fontWeight: 500, display: 'block', marginBottom: 'var(--space-1)'}}>Assignee</label>
                <select name="assigneeId" value={values.assigneeId} onChange={onChange} style={{width: '100%', padding: '8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)'}}>
                  <option value="">Select user</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>

              <div className={styles.fullWidth}>
                <label style={{fontSize: 'var(--text-sm)', fontWeight: 500, display: 'block', marginBottom: 'var(--space-1)'}}>Notes</label>
                <textarea 
                  name="notes" value={values.notes} onChange={onChange}
                  style={{width: '100%', padding: '8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', minHeight: '80px', fontFamily: 'inherit'}}
                  placeholder="Any initial notes about the lead..."
                />
              </div>
            </div>
          )}

          {/* STEP 2: Property & Qualification */}
          {step === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <Input label="Builder Name" name="builder_name" value={values.builder_name} onChange={onChange} onBlur={onBlur} />
                <Input label="Possession Date" type="date" name="possession_date" value={values.possession_date} onChange={onChange} onBlur={onBlur} />
                
                <div>
                  <label style={{fontSize: 'var(--text-sm)', fontWeight: 500, display: 'block', marginBottom: 'var(--space-1)'}}>House Status</label>
                  <select name="house_status" value={values.house_status} onChange={onChange} style={{width: '100%', padding: '8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)'}}>
                    <option value="">Select status</option>
                    <option value="Under Construction">Under Construction</option>
                    <option value="Ready to Move">Ready to Move</option>
                    <option value="Renovation">Renovation</option>
                  </select>
                </div>

                <div>
                  <label style={{fontSize: 'var(--text-sm)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', height: '100%', marginTop: '24px'}}>
                    <input type="checkbox" name="loan_approved" checked={values.loan_approved} onChange={onChange} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    Loan Approved
                  </label>
                </div>

                <Input label="Interior Style" name="interior_style" placeholder="e.g. Modern, Minimal, Luxury" value={values.interior_style} onChange={onChange} onBlur={onBlur} />
                <Input label="Material Preference" name="material_preference" placeholder="e.g. Modular, Wood" value={values.material_preference} onChange={onChange} onBlur={onBlur} />
                <Input label="Preferred Communication" name="preferred_communication" placeholder="Call / WhatsApp" value={values.preferred_communication} onChange={onChange} onBlur={onBlur} />
                <Input label="Preferred Language" name="preferred_language" value={values.preferred_language} onChange={onChange} onBlur={onBlur} />
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer} style={{ display: 'flex', justifyContent: 'space-between' }}>
          {step === 1 ? (
            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          ) : (
            <Button variant="ghost" onClick={handlePrev}>Back</Button>
          )}
          
          {step < totalSteps ? (
            <Button variant="primary" onClick={handleNext}>Next Step</Button>
          ) : (
            <Button variant="primary" onClick={handleSubmit} disabled={isSubmitDisabled}>
              Save Lead
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
