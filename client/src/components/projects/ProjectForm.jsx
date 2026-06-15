import React, { useState, useEffect } from 'react';
import { Button, Input, Select, Textarea, Spinner } from '../ui';
import { configApi } from '../../api/config';
import { createProject, updateProject } from '../../api/projects';
import styles from './ProjectForm.module.css';

const PROJECT_TYPES = [
  { id: 'Full Interior', label: 'Full Interior', icon: '🏠' },
  { id: 'Modular Kitchen', label: 'Kitchen', icon: '🍳' },
  { id: 'Commercial', label: 'Commercial', icon: '🏢' },
  { id: 'Turnkey', label: 'Turnkey', icon: '🔑' },
  { id: 'Renovation', label: 'Renovation', icon: '🔨' }
];

// Mock users since there's no API yet
const MOCK_USERS = [
  { value: 'user1', label: 'Alice Designer (Designer)' },
  { value: 'user2', label: 'Bob Manager (Project Manager)' },
  { value: 'user3', label: 'Charlie Admin' }
];

export default function ProjectForm({ project = null, onSave, onClose }) {
  const isEditing = !!project;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    clientName: project?.clientName || project?.client_name || '',
    clientPhone: project?.clientPhone || project?.client_phone || '',
    clientEmail: project?.clientEmail || project?.client_email || '',
    name: project?.name || '',
    projectType: project?.projectType || project?.project_type || 'Full Interior',
    projectManagerId: project?.projectManagerId || project?.pm_id || '',
    designerId: project?.designerId || '',
    contractValue: project?.contractValue || project?.contract_value || '',
    startDate: project?.startDate?.split('T')[0] || project?.start_date?.split('T')[0] || '',
    targetDate: project?.targetDate?.split('T')[0] || project?.target_date?.split('T')[0] || '',
    siteAddress: project?.siteAddress || project?.site_address || '',
    templateId: project?.templateId || '',
    customFields: project?.customFields || project?.custom_fields || {}
  });

  const [templates, setTemplates] = useState([]);
  const [customFieldsConfig, setCustomFieldsConfig] = useState([]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const [templatesRes, customFieldsRes] = await Promise.all([
          configApi.getTemplates().catch(() => ({ data: { data: [] } })),
          configApi.getCustomFields('project').catch(() => ({ data: { data: [] } }))
        ]);
        
        setTemplates(templatesRes.data?.data || templatesRes.data || []);
        setCustomFieldsConfig(customFieldsRes.data?.data || customFieldsRes.data || []);
      } catch (err) {
        console.error('Failed to load form configuration', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCustomFieldChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      customFields: {
        ...prev.customFields,
        [key]: value
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // Clean up contractValue
      const payload = {
        ...formData,
        contractValue: formData.contractValue ? Number(formData.contractValue) : null,
        // map keys to snake_case for backend if needed, depending on API requirements
        client_name: formData.clientName,
        client_phone: formData.clientPhone,
        client_email: formData.clientEmail,
        project_type: formData.projectType,
        pm_id: formData.projectManagerId,
        designer_id: formData.designerId,
        contract_value: formData.contractValue ? Number(formData.contractValue) : null,
        start_date: formData.startDate || null,
        target_date: formData.targetDate || null,
        site_address: formData.siteAddress,
        template_id: formData.templateId,
        custom_fields: formData.customFields
      };

      let savedProject;
      if (isEditing) {
        const res = await updateProject(project.id, payload);
        savedProject = res.data?.data || res.data;
      } else {
        const res = await createProject(payload);
        savedProject = res.data?.data || res.data;
      }
      
      if (onSave) onSave(savedProject);
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred while saving the project.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {error && <div style={{ color: 'var(--error-color, #ef4444)', padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '8px' }}>{error}</div>}

      <div className={styles.typeSelector}>
        <span className={styles.typeLabel}>Project Type *</span>
        <div className={styles.typeCards}>
          {PROJECT_TYPES.map(type => (
            <div 
              key={type.id}
              className={`${styles.typeCard} ${formData.projectType === type.id ? styles.active : ''}`}
              onClick={() => handleChange('projectType', type.id)}
            >
              <span className={styles.typeIcon}>{type.icon}</span>
              <span>{type.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.sectionTitle}>Client Details</div>
      <div className={styles.grid}>
        <Input 
          label="Client Name" 
          value={formData.clientName} 
          onChange={(e) => handleChange('clientName', e.target.value)} 
          required 
        />
        <Input 
          label="Client Phone" 
          type="tel"
          value={formData.clientPhone} 
          onChange={(e) => handleChange('clientPhone', e.target.value)} 
        />
        <Input 
          label="Client Email" 
          type="email"
          value={formData.clientEmail} 
          onChange={(e) => handleChange('clientEmail', e.target.value)} 
          className={styles.fullWidth}
        />
      </div>

      <div className={styles.sectionTitle}>Project Details</div>
      <div className={styles.grid}>
        <Input 
          label="Project Name" 
          value={formData.name} 
          onChange={(e) => handleChange('name', e.target.value)} 
          required 
          className={styles.fullWidth}
        />
        
        <Select
          label="Project Manager"
          value={formData.projectManagerId}
          onChange={(val) => handleChange('projectManagerId', val)}
          options={MOCK_USERS}
          searchable
          placeholder="Search manager..."
        />
        
        <Select
          label="Designer"
          value={formData.designerId}
          onChange={(val) => handleChange('designerId', val)}
          options={MOCK_USERS}
          searchable
          placeholder="Search designer..."
        />

        <Input 
          label="Contract Value (₹)" 
          type="number"
          value={formData.contractValue} 
          onChange={(e) => handleChange('contractValue', e.target.value)} 
        />
        
        {!isEditing && (
          <Select
            label="Template"
            value={formData.templateId}
            onChange={(val) => handleChange('templateId', val)}
            options={templates.map(t => ({ value: t.id, label: t.name }))}
            placeholder="Select a template..."
          />
        )}

        <Input 
          label="Start Date" 
          type="date"
          value={formData.startDate} 
          onChange={(e) => handleChange('startDate', e.target.value)} 
        />
        
        <Input 
          label="Target Date" 
          type="date"
          value={formData.targetDate} 
          onChange={(e) => handleChange('targetDate', e.target.value)} 
        />

        <Textarea 
          label="Site Address" 
          value={formData.siteAddress} 
          onChange={(e) => handleChange('siteAddress', e.target.value)} 
          className={styles.fullWidth}
        />
      </div>

      {customFieldsConfig.length > 0 && (
        <>
          <div className={styles.sectionTitle}>Custom Fields</div>
          <div className={styles.grid}>
            {customFieldsConfig.map(field => {
              const val = formData.customFields[field.key] || '';
              if (field.type === 'select') {
                const opts = field.options?.map(o => ({ value: o, label: o })) || [];
                return (
                  <Select
                    key={field.key}
                    label={field.label}
                    required={field.required}
                    value={val}
                    onChange={(v) => handleCustomFieldChange(field.key, v)}
                    options={opts}
                  />
                );
              }
              
              if (field.type === 'textarea') {
                return (
                  <Textarea
                    key={field.key}
                    label={field.label}
                    required={field.required}
                    value={val}
                    onChange={(e) => handleCustomFieldChange(field.key, e.target.value)}
                    className={styles.fullWidth}
                  />
                );
              }

              return (
                <Input
                  key={field.key}
                  label={field.label}
                  type={field.type === 'number' ? 'number' : 'text'}
                  required={field.required}
                  value={val}
                  onChange={(e) => handleCustomFieldChange(field.key, e.target.value)}
                />
              );
            })}
          </div>
        </>
      )}

      <div className={styles.actions}>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Project')}
        </Button>
      </div>
    </form>
  );
}
