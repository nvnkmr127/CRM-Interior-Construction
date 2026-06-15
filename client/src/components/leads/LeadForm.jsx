import React, { useState, useEffect } from 'react';
import { Modal, Input, Button } from '../ui';
import api from '../../api/axios';
import { createLead, updateLead } from '../../api/leads';
import { useForm } from '../../hooks/useForm';
import { validators } from '../../utils/validators';
import styles from './LeadForm.module.css';

export default function LeadForm({ lead, onSave, onClose }) {
  const isEdit = !!lead;
  
  const { values, errors, touched, handleChange, handleBlur, validateAll, isValid, setValues } = useForm({
    name: lead?.name || '',
    phone: lead?.phone || '',
    email: lead?.email || '',
    source: lead?.source || '',
    stageId: lead?.stage_id || '',
    assigneeId: lead?.assignee_id || '',
    notes: lead?.notes || '',
    custom_fields: lead?.custom_fields || {}
  }, {
    name: [validators.required, validators.minLen(2)],
    phone: [validators.required, validators.phone],
    email: [validators.email]
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

  const onChange = (e) => handleChange(e.target.name, e.target.value);
  const onBlur = (e) => handleBlur(e.target.name);

  const handleSubmit = async () => {
    if (!validateAll()) return;

    try {
      const res = isEdit 
        ? await updateLead(lead.id, values)
        : await createLead(values);
        
      if (res.success) {
        const assignedUserName = users.find(u => u.id === values.assigneeId)?.name || 'Unassigned';
        window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'success', message: isEdit ? 'Lead updated successfully' : `Lead created and assigned to ${assignedUserName}`, duration: 3000 } }));
        onSave && onSave(res.data);
        onClose();
      }
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Could not save lead. Phone number already exists.';
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'error', message, duration: 6000 } }));
    }
  };

  const isSubmitDisabled = !isValid;

  return (
    <Modal isOpen onClose={onClose}>
      <div className={styles.formWrap}>
        <div className={styles.header}>
          <div className={styles.title}>{isEdit ? 'Edit Lead' : 'New Lead'}</div>
        </div>

        <div className={styles.body}>
          <Input 
            label="Name" required 
            name="name" value={values.name} 
            onChange={onChange} onBlur={onBlur}
            error={touched.name && errors.name}
          />
          <Input 
            label="Phone" required 
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
            />
          </div>
        </div>

        <div className={styles.footer}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={isSubmitDisabled} onClick={handleSubmit}>
            Save Lead
          </Button>
        </div>
      </div>
    </Modal>
  );
}
