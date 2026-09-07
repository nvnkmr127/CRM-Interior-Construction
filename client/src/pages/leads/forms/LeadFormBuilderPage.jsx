import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FaPalette } from 'react-icons/fa';
import { 
  FiArrowLeft, 
  FiSliders, 
  FiLayers, 
  FiSend, 
  FiBell, 
  FiEye, 
  FiSave, 
  FiX, 
  FiPlus, 
  FiTrash2, 
  FiCopy, 
  FiChevronUp, 
  FiChevronDown, 
  FiCheck, 
  FiGlobe, 
  FiSmartphone, 
  FiMonitor, 
  FiTablet, 
  FiLock, 
  FiMail, 
  FiTag, 
  FiUserCheck, 
  FiGrid, 
  FiHelpCircle, 
  FiRefreshCw, 
  FiType, 
  FiList, 
  FiCalendar, 
  FiUpload, 
  FiStar, 
  FiLayers as FiStepIcon 
} from 'react-icons/fi';
import { getFormById, createForm, updateForm } from '../../../api/leadForms';
import { usersApi } from '../../../api/users';
import { useToast } from '../../../store/toastContext';
import styles from './LeadForms.module.css';

const FIELD_CATEGORIES = [
  {
    category: 'Standard Inputs',
    items: [
      { type: 'text', label: 'Short Text', icon: FiType, defaultPlaceholder: 'Enter short text...' },
      { type: 'textarea', label: 'Long Text / Paragraph', icon: FiList, defaultPlaceholder: 'Enter details here...' },
      { type: 'email', label: 'Email Address', icon: FiMail, defaultPlaceholder: 'john@example.com' },
      { type: 'phone', label: 'Phone Number', icon: FiSmartphone, defaultPlaceholder: '+1 (555) 000-0000' },
      { type: 'number', label: 'Numeric Input', icon: FiGrid, defaultPlaceholder: '0' },
      { type: 'date', label: 'Date Picker', icon: FiCalendar, defaultPlaceholder: 'Select date' },
    ]
  },
  {
    category: 'Options & Choices',
    items: [
      { type: 'select', label: 'Dropdown Menu', icon: FiList, defaultOptions: ['Option 1', 'Option 2', 'Option 3'] },
      { type: 'radio', label: 'Radio Buttons', icon: FiCheck, defaultOptions: ['Option A', 'Option B'] },
      { type: 'checkbox', label: 'Checkbox Group', icon: FiCheck, defaultOptions: ['Choice 1', 'Choice 2'] },
      { type: 'rating', label: 'Star Rating', icon: FiStar, defaultPlaceholder: '5' }
    ]
  },
  {
    category: 'Advanced & Layout',
    items: [
      { type: 'file', label: 'File Upload', icon: FiUpload, defaultPlaceholder: 'Upload documents or floor plans' },
      { type: 'hidden', label: 'Hidden / UTM Tag', icon: FiLock, defaultPlaceholder: 'utm_source' },
      { type: 'step', label: 'Step / Page Break', icon: FiStepIcon, defaultLabel: 'Next Step' }
    ]
  }
];

const THEME_PRESETS = [
  {
    name: 'Warm Amber (CRM Default)',
    primaryColor: '#E8935A',
    backgroundColor: '#FAF8F5',
    textColor: '#1C1C1E',
    fontFamily: 'Inter, sans-serif'
  },
  {
    name: 'Modern Indigo',
    primaryColor: '#4f46e5',
    backgroundColor: '#f8fafc',
    textColor: '#0f172a',
    fontFamily: 'Inter, sans-serif'
  },
  {
    name: 'Emerald Eco',
    primaryColor: '#059669',
    backgroundColor: '#f0fdf4',
    textColor: '#064e3b',
    fontFamily: 'Outfit, sans-serif'
  },
  {
    name: 'Midnight Dark',
    primaryColor: '#818cf8',
    backgroundColor: '#0f172a',
    textColor: '#f8fafc',
    fontFamily: 'Roboto, sans-serif'
  }
];

export default function LeadFormBuilderPage() {
  const { id } = useParams();
  const isEditing = Boolean(id && id !== 'new');
  const navigate = useNavigate();
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general'); // general | builder | branding | submission | notifications | preview
  const [users, setUsers] = useState([]);
  const [previewDevice, setPreviewDevice] = useState('desktop'); // desktop | tablet | mobile
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    lead_source: 'Web Form',
    assignee_id: '',
    status: 'active',
    fields: [
      { id: '1', name: 'full_name', label: 'Full Name', type: 'text', required: true, width: '100', placeholder: 'Enter full name', helpText: '' },
      { id: '2', name: 'email', label: 'Email Address', type: 'email', required: true, width: '50', placeholder: 'name@example.com', helpText: '' },
      { id: '3', name: 'phone', label: 'Phone Number', type: 'phone', required: false, width: '50', placeholder: '+1 (555) 000-0000', helpText: '' }
    ],
    settings: {
      branding: {
        logoUrl: '',
        primaryColor: '#E8935A',
        backgroundColor: '#FAF8F5',
        textColor: '#1C1C1E',
        fontFamily: 'Inter, sans-serif',
        customCss: ''
      },
      submission: {
        actionType: 'message', // 'message' or 'redirect'
        successMessage: 'Thank you! Your information has been submitted successfully.',
        redirectUrl: '',
        buttonText: 'Submit Request',
        enableRecaptcha: false,
        enableHoneypot: true
      },
      notifications: {
        internalAlerts: true,
        notificationEmails: '',
        autoResponder: false,
        autoResponderSubject: 'We received your inquiry!',
        autoResponderBody: 'Hello {first_name},\n\nThank you for reaching out to us. A representative will contact you shortly.'
      }
    }
  });

  useEffect(() => {
    loadAssignees();
    if (isEditing) {
      fetchForm();
    }
  }, [id]);

  const loadAssignees = async () => {
    try {
      const data = await usersApi.getAll();
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch (err) {
      console.warn('Could not load users list for assignees:', err);
    }
  };

  const fetchForm = async () => {
    try {
      setIsLoading(true);
      const res = await getFormById(id);
      if (res.success) {
        const d = res.data;
        const parsedSettings = typeof d.settings === 'string' ? JSON.parse(d.settings) : (d.settings || {});
        const parsedFields = typeof d.fields === 'string' ? JSON.parse(d.fields) : (d.fields || []);

        setFormData({
          name: d.name || '',
          slug: d.slug || '',
          description: d.description || '',
          lead_source: d.lead_source || d.leadSource || 'Web Form',
          assignee_id: d.assignee_id || d.assigneeId || '',
          status: d.status || 'active',
          fields: parsedFields.map(f => ({ width: '100', helpText: '', ...f })),
          settings: {
            branding: { logoUrl: '', primaryColor: '#E8935A', backgroundColor: '#FAF8F5', textColor: '#1C1C1E', fontFamily: 'Inter, sans-serif', customCss: '', ...(parsedSettings.branding || {}) },
            submission: { actionType: 'message', successMessage: 'Thank you for your submission!', redirectUrl: '', buttonText: 'Submit Request', enableRecaptcha: false, enableHoneypot: true, ...(parsedSettings.submission || {}) },
            notifications: { internalAlerts: true, notificationEmails: '', autoResponder: false, autoResponderSubject: 'Thank you', autoResponderBody: 'We will be in touch shortly.', ...(parsedSettings.notifications || {}) }
          }
        });
      }
    } catch (error) {
      toast.error('Failed to load form details');
      navigate('/leads/forms');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      return toast.error('Please enter a form name');
    }

    try {
      setIsSaving(true);
      const generatedSlug = formData.slug.trim() || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

      const payload = {
        name: formData.name,
        slug: generatedSlug,
        description: formData.description,
        lead_source: formData.lead_source,
        leadSource: formData.lead_source,
        assignee_id: formData.assignee_id || null,
        assigneeId: formData.assignee_id || null,
        status: formData.status,
        successMessage: formData.settings.submission.successMessage,
        redirectUrl: formData.settings.submission.redirectUrl,
        fields: formData.fields,
        settings: formData.settings
      };

      if (isEditing) {
        await updateForm(id, payload);
        toast.success('Form updated successfully');
      } else {
        await createForm(payload);
        toast.success('Form created successfully');
      }
      navigate('/leads/forms');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save form');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = (category, key, value) => {
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [category]: {
          ...prev.settings[category],
          [key]: value
        }
      }
    }));
  };

  const applyThemePreset = (preset) => {
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        branding: {
          ...prev.settings.branding,
          primaryColor: preset.primaryColor,
          backgroundColor: preset.backgroundColor,
          textColor: preset.textColor,
          fontFamily: preset.fontFamily
        }
      }
    }));
    toast.success(`Applied ${preset.name} theme!`);
  };

  const addField = (typeObj) => {
    const timestamp = Date.now();
    const newField = {
      id: timestamp.toString(),
      name: `field_${timestamp.toString().slice(-6)}`,
      label: typeObj.defaultLabel || typeObj.label,
      type: typeObj.type,
      required: false,
      width: '100',
      placeholder: typeObj.defaultPlaceholder || '',
      helpText: '',
      options: typeObj.defaultOptions ? typeObj.defaultOptions.join(', ') : '',
      conditional_logic: null
    };
    setFormData(prev => ({ ...prev, fields: [...prev.fields, newField] }));
    toast.success(`Added ${typeObj.label}`);
  };

  const updateField = (fieldId, key, value) => {
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.id === fieldId ? { ...f, [key]: value } : f)
    }));
  };

  const duplicateField = (fieldIndex) => {
    const target = formData.fields[fieldIndex];
    const newField = {
      ...target,
      id: Date.now().toString(),
      name: `${target.name}_copy`,
      label: `${target.label} (Copy)`
    };
    const updated = [...formData.fields];
    updated.splice(fieldIndex + 1, 0, newField);
    setFormData(prev => ({ ...prev, fields: updated }));
    toast.success('Field duplicated');
  };

  const moveField = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= formData.fields.length) return;
    const updated = [...formData.fields];
    const [movedItem] = updated.splice(index, 1);
    updated.splice(newIndex, 0, movedItem);
    setFormData(prev => ({ ...prev, fields: updated }));
  };

  const removeField = (fieldId) => {
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.filter(f => f.id !== fieldId)
    }));
    toast.success('Field removed');
  };

  const updateFieldLogic = (fieldId, key, value) => {
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.map(f => {
        if (f.id !== fieldId) return f;
        const logic = f.conditional_logic || { targetField: '', operator: 'equals', value: '' };
        return { ...f, conditional_logic: { ...logic, [key]: value } };
      })
    }));
  };

  const removeFieldLogic = (fieldId) => {
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.id === fieldId ? { ...f, conditional_logic: null } : f)
    }));
  };

  const generateSlug = () => {
    if (!formData.name) return toast.error('Enter form name first');
    const slug = formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    setFormData(prev => ({ ...prev, slug }));
    toast.success('Generated URL slug!');
  };

  // Divide fields into steps if step fields exist
  const getStepGroups = () => {
    const steps = [[]];
    formData.fields.forEach(field => {
      if (field.type === 'step') {
        steps.push([]);
      } else {
        steps[steps.length - 1].push(field);
      }
    });
    return steps;
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>Loading Form Builder...</div>
      </div>
    );
  }

  const stepGroups = getStepGroups();

  return (
    <div className={styles.container}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumb}>
        <span className={styles.breadcrumbLink} onClick={() => navigate('/leads/forms')}>
          <FiArrowLeft /> Back to Lead Forms
        </span>
        <span>/</span>
        <span>{isEditing ? 'Edit Form' : 'New Form Builder'}</span>
      </div>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <div className={styles.headerIcon}>
            <FiLayers />
          </div>
          <div>
            <h2>{isEditing ? formData.name || 'Edit Lead Form' : 'Create New Lead Form'}</h2>
            <p className={styles.headerSubtitle}>
              Design custom capture forms, embed on landing pages, and route leads directly into your CRM.
            </p>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.secondaryBtn} onClick={() => navigate('/leads/forms')}>
            <FiX /> Cancel
          </button>
          <button className={styles.primaryBtn} onClick={handleSave} disabled={isSaving}>
            <FiSave /> {isSaving ? 'Saving...' : 'Save Form'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={styles.tabsContainer}>
        <button className={`${styles.tabBtn} ${activeTab === 'general' ? styles.active : ''}`} onClick={() => setActiveTab('general')}>
          <FiSliders /> General Settings
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'builder' ? styles.active : ''}`} onClick={() => setActiveTab('builder')}>
          <FiLayers /> Form Builder ({formData.fields.length} fields)
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'branding' ? styles.active : ''}`} onClick={() => setActiveTab('branding')}>
          <FaPalette /> Branding & Theme
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'submission' ? styles.active : ''}`} onClick={() => setActiveTab('submission')}>
          <FiSend /> Submission & Security
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'notifications' ? styles.active : ''}`} onClick={() => setActiveTab('notifications')}>
          <FiBell /> Notifications & Email
        </button>
        <button className={`${styles.tabBtn} ${activeTab === 'preview' ? styles.active : ''}`} onClick={() => setActiveTab('preview')}>
          <FiEye /> Interactive Live Preview
        </button>
      </div>

      {/* Tab 1: General Settings */}
      {activeTab === 'general' && (
        <div className={styles.mainArea}>
          <div className={styles.sectionHeader}>
            <h3><FiSliders /> General Form Properties</h3>
            <span className={`${styles.badge} ${styles[formData.status]}`}>{formData.status}</span>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.inputGroup}>
              <label>Form Name <span className={styles.requiredDot}>*</span></label>
              <input 
                type="text" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder="e.g. Website Inquiry Form" 
              />
              <span className={styles.inputHelp}>Used for internal identification and title headers.</span>
            </div>

            <div className={styles.inputGroup}>
              <label>
                <span>URL Slug (Permalink)</span>
                <button type="button" onClick={generateSlug} style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                  Auto-generate
                </button>
              </label>
              <input 
                type="text" 
                value={formData.slug} 
                onChange={e => setFormData({...formData, slug: e.target.value})} 
                placeholder="website-inquiry-form" 
              />
              <span className={styles.inputHelp}>Public URL: /forms/{formData.slug || 'slug'}</span>
            </div>

            <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
              <label>Description / Instructions</label>
              <textarea 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})} 
                rows={3} 
                placeholder="Provide helpful context or guidance for users submitting this form..." 
              />
            </div>

            <div className={styles.inputGroup}>
              <label><FiTag /> Auto-applied Lead Source</label>
              <input 
                type="text" 
                value={formData.lead_source} 
                onChange={e => setFormData({...formData, lead_source: e.target.value})} 
                placeholder="Web Form, Landing Page, Google Ads..." 
              />
              <span className={styles.inputHelp}>Automatically assigned as the source on newly created CRM leads.</span>
            </div>

            <div className={styles.inputGroup}>
              <label><FiUserCheck /> Default Lead Assignee</label>
              <select value={formData.assignee_id} onChange={e => setFormData({...formData, assignee_id: e.target.value})}>
                <option value="">Unassigned (Route to pool)</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name || u.email} ({u.role || 'Member'})</option>
                ))}
              </select>
              <span className={styles.inputHelp}>Automatically assign incoming leads from this form to a specific team member.</span>
            </div>

            <div className={styles.inputGroup}>
              <label>Status</label>
              <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                <option value="active">Active (Receiving Submissions)</option>
                <option value="inactive">Inactive (Disabled)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Form Builder */}
      {activeTab === 'builder' && (
        <div className={styles.builderContainer}>
          {/* Left Palette */}
          <div className={styles.sidebar}>
            <h4 style={{ margin: '0 0 var(--space-4) 0', fontSize: 'var(--text-base)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiPlus /> Add Fields
            </h4>

            {FIELD_CATEGORIES.map((cat, cIdx) => (
              <div key={cIdx}>
                <div className={styles.sidebarSectionTitle}>{cat.category}</div>
                <div className={styles.fieldCategoryList}>
                  {cat.items.map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <button key={item.type} className={styles.addFieldBtn} onClick={() => addField(item)}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <IconComponent style={{ color: 'var(--color-text-secondary)' }} />
                          {item.label}
                        </span>
                        <FiPlus style={{ fontSize: '12px', color: 'var(--color-text-muted)' }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Canvas */}
          <div>
            <div className={styles.sectionHeader}>
              <h3>Form Structure Canvas ({formData.fields.length} fields)</h3>
              <button className={styles.secondaryBtn} onClick={() => setActiveTab('preview')}>
                <FiEye /> Test Live Form
              </button>
            </div>

            {formData.fields.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No fields added yet. Click items from the left palette to build your form!</p>
              </div>
            ) : (
              formData.fields.map((field, index) => (
                <div key={field.id} className={`${styles.fieldItem} ${field.type === 'step' ? styles.stepItem : ''}`}>
                  {/* Field Header */}
                  <div className={styles.fieldItemHeader}>
                    <div className={styles.fieldHeaderLeft}>
                      <span className={styles.dragHandle} title="Reorder field">
                        <FiGrid />
                      </span>
                      <span className={styles.fieldHeaderTitle}>
                        {field.label || 'Untitled Field'}
                        {field.required && <span className={styles.requiredDot}>*</span>}
                      </span>
                      <span className={styles.fieldTypeBadge}>{field.type}</span>
                      {field.width === '50' && <span className={styles.fieldTypeBadge} style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent-dark)' }}>Half Row</span>}
                    </div>

                    <div className={styles.fieldItemActions}>
                      <button className={styles.iconBtn} onClick={() => moveField(index, -1)} disabled={index === 0} title="Move Up">
                        <FiChevronUp />
                      </button>
                      <button className={styles.iconBtn} onClick={() => moveField(index, 1)} disabled={index === formData.fields.length - 1} title="Move Down">
                        <FiChevronDown />
                      </button>
                      <button className={styles.iconBtn} onClick={() => duplicateField(index)} title="Duplicate Field">
                        <FiCopy />
                      </button>
                      <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => removeField(field.id)} title="Delete Field">
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>

                  {/* Field Configuration */}
                  <div className={styles.fieldConfigGrid}>
                    <div className={styles.inputGroup}>
                      <label>Field Label</label>
                      <input type="text" value={field.label} onChange={e => updateField(field.id, 'label', e.target.value)} />
                    </div>

                    <div className={styles.inputGroup}>
                      <label>API Field Key</label>
                      <input type="text" value={field.name} onChange={e => updateField(field.id, 'name', e.target.value)} />
                    </div>

                    {field.type !== 'step' && (
                      <>
                        <div className={styles.inputGroup}>
                          <label>Placeholder</label>
                          <input type="text" value={field.placeholder || ''} onChange={e => updateField(field.id, 'placeholder', e.target.value)} />
                        </div>

                        <div className={styles.inputGroup}>
                          <label>Layout Width</label>
                          <select value={field.width || '100'} onChange={e => updateField(field.id, 'width', e.target.value)}>
                            <option value="100">Full Width (100%)</option>
                            <option value="50">Half Width (50%)</option>
                          </select>
                        </div>
                      </>
                    )}

                    {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
                      <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                        <label>Options (comma separated)</label>
                        <input 
                          type="text" 
                          value={field.options || ''} 
                          onChange={e => updateField(field.id, 'options', e.target.value)} 
                          placeholder="Residential, Commercial, Renovation" 
                        />
                      </div>
                    )}

                    {field.type !== 'step' && field.type !== 'hidden' && (
                      <div className={styles.fullWidth} style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                          <input 
                            type="checkbox" 
                            checked={Boolean(field.required)} 
                            onChange={e => updateField(field.id, 'required', e.target.checked)} 
                          />
                          Required Field
                        </label>
                      </div>
                    )}

                    {/* Conditional Logic Inspector */}
                    <div className={styles.fullWidth} style={{ background: 'var(--color-surface-2)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>Conditional Display Logic</span>
                        {!field.conditional_logic ? (
                          <button type="button" onClick={() => updateFieldLogic(field.id, 'operator', 'equals')} className={styles.secondaryBtn} style={{ padding: '4px 10px', fontSize: '12px' }}>
                            + Add Condition
                          </button>
                        ) : (
                          <button type="button" onClick={() => removeFieldLogic(field.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', fontSize: '12px', cursor: 'pointer' }}>
                            Clear Condition
                          </button>
                        )}
                      </div>

                      {field.conditional_logic && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13px', display: 'flex', alignItems: 'center', color: 'var(--color-text-secondary)' }}>Show when</span>
                          <select 
                            value={field.conditional_logic.targetField} 
                            onChange={e => updateFieldLogic(field.id, 'targetField', e.target.value)}
                            style={{ padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--color-border)', flex: 1 }}
                          >
                            <option value="">Select Target Field...</option>
                            {formData.fields.filter(f => f.id !== field.id && f.type !== 'step').map(f => (
                              <option key={f.id} value={f.name}>{f.label} ({f.name})</option>
                            ))}
                          </select>
                          <select 
                            value={field.conditional_logic.operator} 
                            onChange={e => updateFieldLogic(field.id, 'operator', e.target.value)}
                            style={{ padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                          >
                            <option value="equals">Equals</option>
                            <option value="not_equals">Does Not Equal</option>
                            <option value="contains">Contains</option>
                          </select>
                          <input 
                            type="text" 
                            value={field.conditional_logic.value} 
                            onChange={e => updateFieldLogic(field.id, 'value', e.target.value)}
                            placeholder="Matching value..." 
                            style={{ padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--color-border)', flex: 1 }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Branding & Styling */}
      {activeTab === 'branding' && (
        <div className={styles.mainArea}>
          <div className={styles.sectionHeader}>
            <h3><FaPalette /> Form Styling & Branding Presets</h3>
          </div>

          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-5)' }}>
            Choose a 1-click curated theme or customize individual brand tokens to match your corporate identity.
          </p>

          {/* Theme Presets */}
          <div className={styles.themePresetsGrid}>
            {THEME_PRESETS.map((preset, pIdx) => (
              <div 
                key={pIdx} 
                className={`${styles.presetCard} ${formData.settings.branding.primaryColor === preset.primaryColor ? styles.active : ''}`}
                onClick={() => applyThemePreset(preset)}
              >
                <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)' }}>{preset.name}</span>
                <div className={styles.presetSwatches}>
                  <div className={styles.swatch} style={{ background: preset.primaryColor }} title="Primary" />
                  <div className={styles.swatch} style={{ background: preset.backgroundColor }} title="Background" />
                  <div className={styles.swatch} style={{ background: preset.textColor }} title="Text" />
                </div>
              </div>
            ))}
          </div>

          <div className={styles.formGrid}>
            <div className={styles.inputGroup}>
              <label>Logo Image URL</label>
              <input 
                type="text" 
                value={formData.settings.branding.logoUrl} 
                onChange={e => updateSetting('branding', 'logoUrl', e.target.value)} 
                placeholder="https://yourcompany.com/logo.png" 
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Font Family</label>
              <select 
                value={formData.settings.branding.fontFamily} 
                onChange={e => updateSetting('branding', 'fontFamily', e.target.value)}
              >
                <option value="Inter, sans-serif">Inter (Default)</option>
                <option value="Outfit, sans-serif">Outfit (Modern)</option>
                <option value="Roboto, sans-serif">Roboto</option>
                <option value="system-ui, sans-serif">System Default</option>
              </select>
            </div>

            <div className={styles.inputGroup}>
              <label>Primary Brand Accent Color</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="color" 
                  value={formData.settings.branding.primaryColor} 
                  onChange={e => updateSetting('branding', 'primaryColor', e.target.value)} 
                  style={{ height: '38px', width: '60px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                />
                <input 
                  type="text" 
                  value={formData.settings.branding.primaryColor} 
                  onChange={e => updateSetting('branding', 'primaryColor', e.target.value)} 
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>Form Background Color</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="color" 
                  value={formData.settings.branding.backgroundColor} 
                  onChange={e => updateSetting('branding', 'backgroundColor', e.target.value)} 
                  style={{ height: '38px', width: '60px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                />
                <input 
                  type="text" 
                  value={formData.settings.branding.backgroundColor} 
                  onChange={e => updateSetting('branding', 'backgroundColor', e.target.value)} 
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
              <label>Custom CSS Overrides</label>
              <textarea 
                value={formData.settings.branding.customCss} 
                onChange={e => updateSetting('branding', 'customCss', e.target.value)} 
                rows={5} 
                style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                placeholder="/* Inject custom CSS rules for public form */&#10;.form-submit-btn { border-radius: 20px; }"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Submission & Security */}
      {activeTab === 'submission' && (
        <div className={styles.mainArea}>
          <div className={styles.sectionHeader}>
            <h3><FiSend /> Submission Behavior & Security</h3>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.inputGroup}>
              <label>Submit Button Text</label>
              <input 
                type="text" 
                value={formData.settings.submission.buttonText} 
                onChange={e => updateSetting('submission', 'buttonText', e.target.value)} 
                placeholder="Submit Request" 
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Post-Submission Action</label>
              <select 
                value={formData.settings.submission.actionType} 
                onChange={e => updateSetting('submission', 'actionType', e.target.value)}
              >
                <option value="message">Display Success Message</option>
                <option value="redirect">Redirect to Custom URL</option>
              </select>
            </div>

            {formData.settings.submission.actionType === 'message' ? (
              <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                <label>Success Message Text</label>
                <textarea 
                  value={formData.settings.submission.successMessage} 
                  onChange={e => updateSetting('submission', 'successMessage', e.target.value)} 
                  rows={3} 
                />
              </div>
            ) : (
              <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                <label>Redirect Target URL</label>
                <input 
                  type="url" 
                  value={formData.settings.submission.redirectUrl} 
                  onChange={e => updateSetting('submission', 'redirectUrl', e.target.value)} 
                  placeholder="https://yourwebsite.com/thank-you" 
                />
              </div>
            )}
          </div>

          <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-5)', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
            <h4 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--text-base)', color: 'var(--color-text)' }}>Spam & Abuse Protection</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                <input 
                  type="checkbox" 
                  checked={formData.settings.submission.enableHoneypot} 
                  onChange={e => updateSetting('submission', 'enableHoneypot', e.target.checked)} 
                />
                Enable Invisible Honeypot Spam Trap (Recommended - Prevents bot submissions without captchas)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                <input 
                  type="checkbox" 
                  checked={formData.settings.submission.enableRecaptcha} 
                  onChange={e => updateSetting('submission', 'enableRecaptcha', e.target.checked)} 
                />
                Enable Google reCAPTCHA v3 Validation
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Notifications & Auto-responder */}
      {activeTab === 'notifications' && (
        <div className={styles.mainArea}>
          <div className={styles.sectionHeader}>
            <h3><FiBell /> Internal Alerts & Lead Auto-responder</h3>
          </div>

          <div className={styles.formGrid}>
            <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={formData.settings.notifications.internalAlerts} 
                  onChange={e => updateSetting('notifications', 'internalAlerts', e.target.checked)} 
                />
                Send CRM Notification to Lead Assignee upon new submission
              </label>
            </div>

            <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
              <label>Additional Notification Emails (comma separated)</label>
              <input 
                type="text" 
                value={formData.settings.notifications.notificationEmails || ''} 
                onChange={e => updateSetting('notifications', 'notificationEmails', e.target.value)} 
                placeholder="sales@company.com, manager@company.com" 
              />
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-5)', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <h4 style={{ margin: 0, fontSize: 'var(--text-base)', color: 'var(--color-text)' }}>Lead Auto-Responder Email</h4>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                <input 
                  type="checkbox" 
                  checked={formData.settings.notifications.autoResponder} 
                  onChange={e => updateSetting('notifications', 'autoResponder', e.target.checked)} 
                />
                Enable Auto-responder
              </label>
            </div>

            {formData.settings.notifications.autoResponder && (
              <div className={styles.formGrid} style={{ marginTop: '12px' }}>
                <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                  <label>Email Subject</label>
                  <input 
                    type="text" 
                    value={formData.settings.notifications.autoResponderSubject} 
                    onChange={e => updateSetting('notifications', 'autoResponderSubject', e.target.value)} 
                  />
                </div>

                <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                  <label>Email Content</label>
                  <textarea 
                    value={formData.settings.notifications.autoResponderBody} 
                    onChange={e => updateSetting('notifications', 'autoResponderBody', e.target.value)} 
                    rows={5} 
                  />
                  <span className={styles.inputHelp}>Supports variables like {'{first_name}'}, {'{form_name}'}.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Interactive Live Preview */}
      {activeTab === 'preview' && (
        <div className={styles.previewContainer}>
          {/* Device Switcher */}
          <div className={styles.deviceSelector}>
            <button className={`${styles.deviceBtn} ${previewDevice === 'desktop' ? styles.active : ''}`} onClick={() => setPreviewDevice('desktop')}>
              <FiMonitor /> Desktop
            </button>
            <button className={`${styles.deviceBtn} ${previewDevice === 'tablet' ? styles.active : ''}`} onClick={() => setPreviewDevice('tablet')}>
              <FiTablet /> Tablet
            </button>
            <button className={`${styles.deviceBtn} ${previewDevice === 'mobile' ? styles.active : ''}`} onClick={() => setPreviewDevice('mobile')}>
              <FiSmartphone /> Mobile
            </button>
          </div>

          {/* Form Card Frame */}
          <div 
            className={`${styles.previewFrame} ${styles[previewDevice]}`}
            style={{ 
              backgroundColor: formData.settings.branding.backgroundColor || '#ffffff',
              fontFamily: formData.settings.branding.fontFamily || 'Inter, sans-serif'
            }}
          >
            {formData.settings.branding.logoUrl && (
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <img src={formData.settings.branding.logoUrl} alt="Logo" style={{ maxHeight: '50px' }} />
              </div>
            )}

            <h2 style={{ color: formData.settings.branding.textColor || '#1C1C1E', margin: '0 0 8px 0', textAlign: 'center' }}>
              {formData.name || 'Untitled Form'}
            </h2>
            {formData.description && (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', textAlign: 'center', margin: '0 0 24px 0' }}>
                {formData.description}
              </p>
            )}

            {/* Multi-step pagination header if steps exist */}
            {stepGroups.length > 1 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  <span>Step {currentStepIndex + 1} of {stepGroups.length}</span>
                  <span>{Math.round(((currentStepIndex + 1) / stepGroups.length) * 100)}% Completed</span>
                </div>
                <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      height: '100%', 
                      width: `${((currentStepIndex + 1) / stepGroups.length) * 100}%`, 
                      background: formData.settings.branding.primaryColor || '#E8935A', 
                      transition: 'width 0.3s ease' 
                    }} 
                  />
                </div>
              </div>
            )}

            {/* Render step fields */}
            <form onSubmit={(e) => { e.preventDefault(); toast.success('Preview form submitted!'); }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                {(stepGroups[currentStepIndex] || []).map((field) => (
                  <div key={field.id} style={{ width: field.width === '50' ? 'calc(50% - 8px)' : '100%' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: formData.settings.branding.textColor || '#1C1C1E' }}>
                      {field.label} {field.required && <span style={{ color: '#dc2626' }}>*</span>}
                    </label>

                    {field.type === 'textarea' ? (
                      <textarea rows={3} placeholder={field.placeholder} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                    ) : field.type === 'select' ? (
                      <select style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                        <option value="">-- Select an option --</option>
                        {(field.options || '').split(',').map((opt, oIdx) => (
                          <option key={oIdx} value={opt.trim()}>{opt.trim()}</option>
                        ))}
                      </select>
                    ) : field.type === 'radio' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {(field.options || '').split(',').map((opt, oIdx) => (
                          <label key={oIdx} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input type="radio" name={field.name} /> {opt.trim()}
                          </label>
                        ))}
                      </div>
                    ) : field.type === 'checkbox' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {(field.options || '').split(',').map((opt, oIdx) => (
                          <label key={oIdx} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input type="checkbox" /> {opt.trim()}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <input 
                        type={field.type === 'phone' ? 'tel' : field.type} 
                        placeholder={field.placeholder} 
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} 
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Multi-step or Submit buttons */}
              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                {currentStepIndex > 0 && (
                  <button 
                    type="button"
                    className={styles.secondaryBtn} 
                    onClick={() => setCurrentStepIndex(prev => prev - 1)}
                  >
                    Previous Step
                  </button>
                )}

                {currentStepIndex < stepGroups.length - 1 ? (
                  <button 
                    type="button"
                    className={styles.primaryBtn} 
                    style={{ background: formData.settings.branding.primaryColor || '#E8935A', marginLeft: 'auto' }}
                    onClick={() => setCurrentStepIndex(prev => prev + 1)}
                  >
                    Next Step
                  </button>
                ) : (
                  <button 
                    type="submit" 
                    className={styles.primaryBtn} 
                    style={{ background: formData.settings.branding.primaryColor || '#E8935A', width: currentStepIndex > 0 ? 'auto' : '100%' }}
                  >
                    {formData.settings.submission.buttonText || 'Submit'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
