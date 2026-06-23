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
  
  const rules = React.useMemo(() => ({
    name: run(validators.required('Name'), validators.minLen(2, 'Name')),
    phone: run(validators.required('Phone'), validators.phone),
    email: validators.email
  }), []);

  const { values, errors, touched, handleChange, handleBlur, validateAll, isValid } = useForm({
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
  }, rules);

  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/config/lead-stages').catch(()=>({data:{data:[]}})),
      api.get('/users').catch(()=>({data:{data:[]}}))
    ]).then(([sRes, uRes]) => {
      const fetchedStages = sRes.data?.data || [];
      setStages(fetchedStages);
      setUsers(uRes.data?.data || []);
      
      if (!isEdit && fetchedStages.length > 0 && !values.stageId) {
        handleChange('stageId', fetchedStages[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    handleChange(name, type === 'checkbox' ? checked : value);
  };
  const onBlur = (e) => handleBlur(e.target.name);

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

  const handleClose = () => {
    if (Object.keys(touched).length > 0) {
      if (!window.confirm("You have unsaved changes. Are you sure you want to discard them?")) {
        return;
      }
    }
    onClose();
  };

  return (
    <Modal isOpen onClose={handleClose} size="xl">
      <div className={styles.formWrap}>
        <div className={styles.header}>
          <div className={styles.title}>{isEdit ? 'Edit Lead' : 'New Lead Entry'}</div>
        </div>

        <div className={styles.scrollBody}>
          
          {/* SECTION: Contact Details */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Contact Information</div>
            <div className={styles.grid2}>
              <Input 
                label="Full Name *" required 
                name="name" value={values.name} 
                onChange={onChange} onBlur={onBlur}
                error={touched.name && errors.name}
              />
              <Input 
                label="Phone Number *" required 
                name="phone" value={values.phone} 
                onChange={onChange} onBlur={onBlur}
                error={touched.phone && errors.phone}
              />
              <Input 
                label="Email Address" 
                name="email" value={values.email} 
                onChange={onChange} onBlur={onBlur}
                error={touched.email && errors.email}
              />
              <div>
                <label className={styles.fieldLabel}>Lead Source</label>
                <select name="source" value={values.source} onChange={onChange} className={styles.selectInput}>
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
          </div>

          {/* SECTION: Property & Qualification */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Property & Qualification</div>
            <div className={styles.grid2}>
              <Input label="Builder Name" name="builder_name" value={values.builder_name} onChange={onChange} onBlur={onBlur} />
              <Input label="Possession Date" type="date" name="possession_date" value={values.possession_date} onChange={onChange} onBlur={onBlur} />
              
              <div>
                <label className={styles.fieldLabel}>House Status</label>
                <select name="house_status" value={values.house_status} onChange={onChange} className={styles.selectInput}>
                  <option value="">Select status</option>
                  <option value="Under Construction">Under Construction</option>
                  <option value="Ready to Move">Ready to Move</option>
                  <option value="Renovation">Renovation</option>
                </select>
              </div>

              <div>
                <label className={styles.checkboxWrap}>
                  <input type="checkbox" name="loan_approved" checked={values.loan_approved} onChange={onChange} className={styles.checkboxInput} />
                  Loan Approved
                </label>
              </div>
            </div>
          </div>

          {/* SECTION: Preferences */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Design Preferences</div>
            <div className={styles.grid2}>
              <Input label="Interior Style" name="interior_style" placeholder="e.g. Modern, Minimal, Luxury" value={values.interior_style} onChange={onChange} onBlur={onBlur} />
              <Input label="Material Preference" name="material_preference" placeholder="e.g. Modular, Wood" value={values.material_preference} onChange={onChange} onBlur={onBlur} />
              <Input label="Preferred Communication" name="preferred_communication" placeholder="Call / WhatsApp" value={values.preferred_communication} onChange={onChange} onBlur={onBlur} />
              <Input label="Preferred Language" name="preferred_language" value={values.preferred_language} onChange={onChange} onBlur={onBlur} />
            </div>
          </div>

          {/* SECTION: Assignment & Notes */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Assignment & Notes</div>
            <div className={styles.grid2}>
              <div>
                <label className={styles.fieldLabel}>Lead Stage</label>
                <select name="stageId" value={values.stageId} onChange={onChange} className={styles.selectInput}>
                  <option value="">Select stage</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className={styles.fieldLabel}>Assignee</label>
                <select name="assigneeId" value={values.assigneeId} onChange={onChange} className={styles.selectInput}>
                  <option value="">Select user</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>

              <div className={styles.fullWidth}>
                <label className={styles.fieldLabel}>Notes / Requirements</label>
                <textarea 
                  name="notes" value={values.notes} onChange={onChange}
                  className={styles.textAreaInput}
                  placeholder="Any initial notes or specific requirements about the lead..."
                />
              </div>
            </div>
          </div>

        </div>

        <div className={styles.footer}>
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!isValid}>
            Save Lead
          </Button>
        </div>
      </div>
    </Modal>
  );
}
