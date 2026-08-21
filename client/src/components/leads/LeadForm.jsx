import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, Select } from '../ui';
import api from '../../api/axios';
import { createLead, updateLead } from '../../api/leads';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../store/toastContext';
import { validators, run } from '../../utils/validators';
import { useFieldPermissions } from '../../hooks/useFieldPermissions';
import styles from './LeadForm.module.css';

import { useConfirm } from '../../store/confirmContext';

export default function LeadForm({ lead, onSave, onClose, editSection }) {
  const { confirm } = useConfirm();

  const isEdit = !!lead;
  const toast = useToast();
  const { isHidden, isReadOnly } = useFieldPermissions('leads');

  // Determine which sections to show based on editSection prop
  const showSection = (section) => !editSection || editSection === section;

  // Section title map for modal header
  const sectionTitles = {
    contact: 'Edit Contact Info',
    property: 'Edit Property Details',
    preferences: 'Edit Preferences'
  };

  // ── 1. Independent state (no circular deps) ──────────────────────────
  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  // Separate stageId state so `rules` can depend on it without needing `values`
  const [stageId, setStageId] = useState(lead?.stage_id || '');

  // ── 2. Rules depend only on `stages` + `stageId` state (no `values`) ─
  const rules = React.useMemo(() => {
    const stage = stages.find(s => s.id === stageId);
    const mFields = stage?.mandatory_fields || [];
    const baseRules = {
      name: run(validators.required('Name'), validators.minLen(2, 'Name')),
      phone: run(validators.required('Phone'), validators.phone),
    };
    if (mFields.includes('email')) {
      baseRules.email = run(validators.required('Email'), validators.email);
    } else {
      baseRules.email = validators.email;
    }
    (Array.isArray(mFields) ? mFields : []).forEach(f => {
      if (!baseRules[f] && f !== 'email') {
        const labelName = f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        baseRules[f] = validators.required(labelName);
      }
    });
    return baseRules;
  }, [stages, stageId]);

  // ── 3. useForm is now safe — `rules` has no dep on `values` ──────────
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
    referral_source: lead?.referral_source || '',
    dnc_flag: lead?.dnc_flag || false,
    consent_whatsapp: lead?.consent_whatsapp || false,
    referred_by_lead_id: lead?.referred_by_lead_id || '',
    property_type: lead?.property_type || '',
    segment: lead?.segment || '',
    scope: lead?.scope || '',
    property_name: lead?.property_name || '',
    locality: lead?.locality || '',
    carpet_area_sqft: lead?.carpet_area_sqft || '',
    budget_max: lead?.budget_max || '',
    possession_month: lead?.possession_month || ''
  }, rules);

  // ── 4. isReq is safe here — declared after `values` exists ───────────
  const isReq = (field) => {
    if (field === 'name' || field === 'phone') return true;
    const stage = stages.find(s => s.id === stageId);
    return stage?.mandatory_fields?.includes(field) || false;
  };

  useEffect(() => {
    Promise.all([
      api.get('/config/lead-stages').catch(()=>({data:{data:[]}})),
      api.get('/users').catch(()=>({data:{data:[]}})),
      api.get('/leads?limit=1000').catch(()=>({data:{data:[]}}))
    ]).then(([sRes, uRes, lRes]) => {
      const fetchedStages = sRes.data?.data || [];
      setStages(fetchedStages);
      setUsers(uRes.data?.data || []);
      setLeads(lRes.data?.data || []);

      if (!isEdit && fetchedStages.length > 0 && !values.stageId) {
        const firstId = fetchedStages[0].id;
        handleChange('stageId', firstId);
        setStageId(firstId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    handleChange(name, newValue);
    // Keep stageId state in sync so `rules` stays up-to-date
    if (name === 'stageId') setStageId(newValue);
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
      if (!payload.referred_by_lead_id) payload.referred_by_lead_id = null;
      
      if (isEdit && lead) {
        payload.updated_at = lead.updated_at;
      }

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

  const handleClose = async () => {
    if (Object.keys(touched).length > 0) {
      if (!await confirm("You have unsaved changes. Are you sure you want to discard them?")) {
        return;
      }
    }
    onClose();
  };

  return (
    <Modal isOpen onClose={handleClose} size={editSection ? 'md' : 'xl'}>
      <div className={styles.formWrap}>
        <div className={styles.header}>
          <div className={styles.title}>{editSection ? sectionTitles[editSection] : (isEdit ? 'Edit Lead' : 'New Lead Entry')}</div>
        </div>

        <div className={styles.scrollBody}>
          
          {/* SECTION: Contact Details */}
          {showSection('contact') && (
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
                  label={`Email Address${isReq('email') ? ' *' : ''}`} 
                  required={isReq('email')}
                  name="email" value={values.email} 
                  onChange={onChange} onBlur={onBlur}
                  error={touched.email && errors.email}
                />
                {!isHidden('source') && (
                  <div>
                    <label className={styles.fieldLabel}>Lead Source{isReq('source') ? ' *' : ''}</label>
                    <select name="source" value={values.source} onChange={onChange} className={styles.selectInput} disabled={isReadOnly('source')}>
                      <option value="">Select source</option>
                      <option value="Facebook">Facebook</option>
                      <option value="IndiaMART">IndiaMART</option>
                      <option value="Referral">Referral</option>
                      <option value="Website">Website</option>
                      <option value="Direct">Direct</option>
                      <option value="Other">Other</option>
                    </select>
                    {touched.source && errors.source && <span className={styles.errorText}>{errors.source}</span>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION: Property Details */}
          {showSection('property') && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Property Details</div>
              <div className={styles.grid2}>
                <div>
                  <label className={styles.fieldLabel}>Type of Property</label>
                  <select name="property_type" value={values.property_type} onChange={onChange} className={styles.selectInput}>
                    <option value="">Select...</option>
                    <option value="1bhk">1 BHK</option>
                    <option value="2bhk">2 BHK</option>
                    <option value="3bhk">3 BHK</option>
                    <option value="4bhk">4 BHK</option>
                    <option value="5bhk">5 BHK</option>
                  </select>
                </div>

                <div>
                  <label className={styles.fieldLabel}>Segment</label>
                  <select name="segment" value={values.segment} onChange={onChange} className={styles.selectInput}>
                    <option value="">Select...</option>
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="hospitality">Hospitality</option>
                    <option value="retail">Retail</option>
                  </select>
                </div>

                <div className={styles.fullWidth}>
                  <label className={styles.fieldLabel}>Product Scope</label>
                  <Select
                    multi
                    options={[
                      { value: 'kitchen', label: 'Kitchen' },
                      { value: 'bedroom', label: 'Bedroom' },
                      { value: 'wardrobe', label: 'Wardrobe' },
                      { value: 'fullhouse', label: 'Full House' },
                      { value: 'living_room', label: 'Living Room' },
                      { value: 'bathroom', label: 'Bathroom' },
                      { value: 'office', label: 'Office / Study' },
                      { value: 'false_ceiling', label: 'False Ceiling' },
                      { value: 'flooring', label: 'Flooring' },
                      { value: 'painting', label: 'Painting' },
                      { value: 'custom_furniture', label: 'Custom Furniture' }
                    ]}
                    value={typeof values.scope === 'string' && values.scope ? values.scope.split(',') : (Array.isArray(values.scope) ? values.scope : [])}
                    onChange={selectedArray => {
                      const newValue = selectedArray.join(',');
                      handleChange('scope', newValue);
                    }}
                    placeholder="Select products..."
                  />
                </div>

                <div className={styles.fullWidth}>
                  <Input label="Property Name / Complex" name="property_name" value={values.property_name} onChange={onChange} onBlur={onBlur} placeholder="e.g. Prestige Shantiniketan" />
                </div>

                <div className={styles.fullWidth}>
                  <Input label="Locality / Address" name="locality" value={values.locality} onChange={onChange} onBlur={onBlur} placeholder="e.g. Indiranagar, Bangalore" />
                </div>

                <Input label="Carpet Area (sq.ft)" name="carpet_area_sqft" type="number" value={values.carpet_area_sqft} onChange={onChange} onBlur={onBlur} placeholder="0" />
                <Input label="Budget Max (₹)" name="budget_max" type="number" value={values.budget_max} onChange={onChange} onBlur={onBlur} placeholder="1500000" />

                <div className={styles.fullWidth}>
                  <Input label="Possession Date" name="possession_month" type="date" value={values.possession_month ? (values.possession_month.length > 10 ? values.possession_month.substring(0, 10) : values.possession_month) : ''} onChange={onChange} onBlur={onBlur} />
                </div>
              </div>
            </div>
          )}

          {/* SECTION: Preferences */}
          {showSection('preferences') && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Design Preferences</div>
              <div className={styles.grid2}>
                <Input label={`Interior Style${isReq('interior_style') ? ' *' : ''}`} required={isReq('interior_style')} error={touched.interior_style && errors.interior_style} name="interior_style" placeholder="e.g. Modern, Minimal, Luxury" value={values.interior_style} onChange={onChange} onBlur={onBlur} />
                <Input label={`Material Preference${isReq('material_preference') ? ' *' : ''}`} required={isReq('material_preference')} error={touched.material_preference && errors.material_preference} name="material_preference" placeholder="e.g. Modular, Wood" value={values.material_preference} onChange={onChange} onBlur={onBlur} />
                <Input label={`Preferred Communication${isReq('preferred_communication') ? ' *' : ''}`} required={isReq('preferred_communication')} error={touched.preferred_communication && errors.preferred_communication} name="preferred_communication" placeholder="Call / WhatsApp" value={values.preferred_communication} onChange={onChange} onBlur={onBlur} />
                <Input label={`Preferred Language${isReq('preferred_language') ? ' *' : ''}`} required={isReq('preferred_language')} error={touched.preferred_language && errors.preferred_language} name="preferred_language" value={values.preferred_language} onChange={onChange} onBlur={onBlur} />
                <div className="flex flex-col gap-2 mt-4">
                  <label className={styles.checkboxWrap}>
                    <input type="checkbox" name="dnc_flag" checked={values.dnc_flag} onChange={onChange} className={styles.checkboxInput} />
                    Do Not Contact (DNC)
                  </label>
                  <label className={styles.checkboxWrap}>
                    <input type="checkbox" name="consent_whatsapp" checked={values.consent_whatsapp} onChange={onChange} className={styles.checkboxInput} />
                    WhatsApp Consent Given
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* SECTION: Assignment & Notes - only show when not editing a specific section */}
          {!editSection && (
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

                <div>
                  <label className={styles.fieldLabel}>Referred By</label>
                  <select name="referred_by_lead_id" value={values.referred_by_lead_id} onChange={onChange} className={styles.selectInput}>
                    <option value="">Select lead</option>
                    {leads.filter(l => l.id !== lead?.id).map(l => (
                      <option key={l.id} value={l.id}>{l.name} {l.phone ? `(${l.phone})` : ''}</option>
                    ))}
                  </select>
                </div>

                {!isHidden('internal_notes') && (
                  <div className={styles.fullWidth}>
                    <label className={styles.fieldLabel}>Notes / Requirements</label>
                    <textarea 
                      name="notes" value={values.notes} onChange={onChange}
                      className={styles.textAreaInput}
                      placeholder="Any initial notes or specific requirements about the lead..."
                      disabled={isReadOnly('internal_notes')}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

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
