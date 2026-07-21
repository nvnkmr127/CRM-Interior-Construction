import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getFormById, createForm, updateForm } from '../../../api/leadForms';
import { useToast } from '../../../store/toastContext';
import styles from './LeadForms.module.css';

const FIELD_TYPES = [
  { type: 'text', label: 'Short Text' },
  { type: 'textarea', label: 'Long Text' },
  { type: 'email', label: 'Email' },
  { type: 'phone', label: 'Phone' },
  { type: 'number', label: 'Number' },
  { type: 'select', label: 'Dropdown' },
  { type: 'radio', label: 'Radio Buttons' },
  { type: 'checkbox', label: 'Checkbox' },
  { type: 'date', label: 'Date' },
  { type: 'file', label: 'File Upload' },
  { type: 'hidden', label: 'Hidden Field' },
  { type: 'step', label: 'Step / Page Break' }
];

export default function LeadFormBuilderPage() {
  const { id } = useParams();
  const isEditing = id && id !== 'new';
  const navigate = useNavigate();
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(isEditing);
  const [activeTab, setActiveTab] = useState('general'); // general | branding | builder | submission | notifications

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    lead_source: 'Web Form',
    status: 'active',
    fields: [
      { id: '1', name: 'name', label: 'Full Name', type: 'text', required: true, placeholder: 'Enter your name' },
      { id: '2', name: 'email', label: 'Email Address', type: 'email', required: true, placeholder: 'Enter email' }
    ],
    settings: {
      branding: {
        logoUrl: '',
        primaryColor: '#4f46e5',
        backgroundColor: '#ffffff',
        fontFamily: 'Inter, sans-serif',
        customCss: ''
      },
      submission: {
        actionType: 'message', // 'message' or 'redirect'
        successMessage: 'Thank you for your submission!',
        redirectUrl: '',
        buttonText: 'Submit',
        enableRecaptcha: false
      },
      notifications: {
        internalAlerts: false,
        autoResponder: false,
        autoResponderSubject: 'Thank you for contacting us',
        autoResponderBody: 'We have received your details and will get back to you shortly.'
      }
    }
  });

  useEffect(() => {
    if (isEditing) {
      fetchForm();
    }
  }, [id]);

  const fetchForm = async () => {
    try {
      const data = await getFormById(id);
      if (data.success) {
        const d = data.data;
        const parsedSettings = typeof d.settings === 'string' ? JSON.parse(d.settings) : (d.settings || {});
        // Ensure defaults exist for nested objects
        const settings = {
          branding: { logoUrl: '', primaryColor: '#4f46e5', backgroundColor: '#ffffff', fontFamily: 'Inter, sans-serif', customCss: '', ...(parsedSettings.branding || {}) },
          submission: { actionType: 'message', successMessage: 'Thank you for your submission!', redirectUrl: '', buttonText: 'Submit', enableRecaptcha: false, ...(parsedSettings.submission || {}) },
          notifications: { internalAlerts: false, autoResponder: false, autoResponderSubject: 'Thank you', autoResponderBody: 'We will be in touch.', ...(parsedSettings.notifications || {}) }
        };

        setFormData({
          ...d,
          fields: typeof d.fields === 'string' ? JSON.parse(d.fields) : d.fields,
          settings
        });
      }
    } catch (error) {
      toast.addToast('Failed to load form', 'error');
      navigate('/leads/forms');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.name) return toast.addToast('Form name is required', 'error');
      
      const payload = {
        ...formData,
        slug: formData.slug || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      };

      if (isEditing) {
        await updateForm(id, payload);
        toast.addToast('Form updated successfully', 'success');
      } else {
        await createForm(payload);
        toast.addToast('Form created successfully', 'success');
      }
      navigate('/leads/forms');
    } catch (error) {
      toast.addToast(error.response?.data?.error || 'Failed to save form', 'error');
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

  const addField = (type) => {
    const newField = {
      id: Date.now().toString(),
      name: `field_${Date.now()}`,
      label: type === 'step' ? 'New Step' : 'New Field',
      type: type,
      required: false,
      placeholder: '',
      conditional_logic: null // e.g. { targetField: 'type', operator: 'equals', value: 'commercial' }
    };
    setFormData(prev => ({ ...prev, fields: [...prev.fields, newField] }));
  };

  const updateField = (fieldId, key, value) => {
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.id === fieldId ? { ...f, [key]: value } : f)
    }));
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

  const removeField = (fieldId) => {
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.filter(f => f.id !== fieldId)
    }));
  };

  const TabButton = ({ id, label }) => (
    <button 
      onClick={() => setActiveTab(id)}
      style={{ 
        padding: '10px 20px', 
        background: activeTab === id ? '#ffffff' : '#f3f4f6', 
        border: '1px solid #e5e7eb', 
        borderBottom: activeTab === id ? '2px solid #4f46e5' : '1px solid #e5e7eb',
        cursor: 'pointer',
        fontWeight: activeTab === id ? '600' : '400',
        color: activeTab === id ? '#4f46e5' : '#4b5563'
      }}
    >
      {label}
    </button>
  );

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{isEditing ? 'Edit Form' : 'Create New Form'}</h2>
        <div>
          <button className={styles.actions} onClick={() => navigate('/leads/forms')} style={{ marginRight: '10px', background: 'white' }}>Cancel</button>
          <button className={styles.primaryBtn} onClick={handleSave}>Save Form</button>
        </div>
      </div>

      <div style={{ display: 'flex', marginBottom: '24px', borderBottom: '1px solid #e5e7eb' }}>
        <TabButton id="general" label="General" />
        <TabButton id="branding" label="Branding" />
        <TabButton id="builder" label="Form Builder" />
        <TabButton id="submission" label="Submission" />
        <TabButton id="notifications" label="Notifications" />
      </div>

      {activeTab === 'general' && (
        <div className={styles.mainArea}>
          <h3>General Settings</h3>
          <div className={styles.inputGroup} style={{ marginBottom: '16px' }}>
            <label>Form Name</label>
            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Website Contact Form" />
          </div>
          <div className={styles.inputGroup} style={{ marginBottom: '16px' }}>
            <label>URL Slug (optional)</label>
            <input type="text" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} placeholder="Leave blank to auto-generate" />
          </div>
          <div className={styles.inputGroup} style={{ marginBottom: '16px' }}>
            <label>Description</label>
            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3} style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '4px' }} />
          </div>
          <div className={styles.inputGroup} style={{ marginBottom: '16px' }}>
            <label>Lead Source (Auto-applied to leads)</label>
            <input type="text" value={formData.lead_source} onChange={e => setFormData({...formData, lead_source: e.target.value})} />
          </div>
          <div className={styles.inputGroup} style={{ marginBottom: '16px' }}>
            <label>Status</label>
            <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      )}

      {activeTab === 'branding' && (
        <div className={styles.mainArea}>
          <h3>Branding & Theme</h3>
          <div className={styles.inputGroup} style={{ marginBottom: '16px' }}>
            <label>Logo URL (Leave blank to hide)</label>
            <input type="text" value={formData.settings.branding.logoUrl} onChange={e => updateSetting('branding', 'logoUrl', e.target.value)} placeholder="https://..." />
          </div>
          <div className={styles.inputGroup} style={{ marginBottom: '16px' }}>
            <label>Primary Brand Color (Buttons & Highlights)</label>
            <input type="color" value={formData.settings.branding.primaryColor} onChange={e => updateSetting('branding', 'primaryColor', e.target.value)} style={{ padding: '0', height: '40px', width: '100px' }} />
          </div>
          <div className={styles.inputGroup} style={{ marginBottom: '16px' }}>
            <label>Background Color</label>
            <input type="color" value={formData.settings.branding.backgroundColor} onChange={e => updateSetting('branding', 'backgroundColor', e.target.value)} style={{ padding: '0', height: '40px', width: '100px' }} />
          </div>
          <div className={styles.inputGroup} style={{ marginBottom: '16px' }}>
            <label>Font Family</label>
            <select value={formData.settings.branding.fontFamily} onChange={e => updateSetting('branding', 'fontFamily', e.target.value)} style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
              <option value="Inter, sans-serif">Inter</option>
              <option value="Roboto, sans-serif">Roboto</option>
              <option value="Outfit, sans-serif">Outfit</option>
              <option value="system-ui, sans-serif">System UI</option>
            </select>
          </div>
          <div className={styles.inputGroup} style={{ marginBottom: '16px' }}>
            <label>Custom CSS</label>
            <textarea value={formData.settings.branding.customCss} onChange={e => updateSetting('branding', 'customCss', e.target.value)} rows={6} style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '4px', fontFamily: 'monospace' }} placeholder="/* Inject your own css here */" />
          </div>
        </div>
      )}

      {activeTab === 'submission' && (
        <div className={styles.mainArea}>
          <h3>Submission Settings</h3>
          
          <div className={styles.inputGroup} style={{ marginBottom: '16px' }}>
            <label>Submit Button Text</label>
            <input type="text" value={formData.settings.submission.buttonText} onChange={e => updateSetting('submission', 'buttonText', e.target.value)} placeholder="Submit" />
          </div>

          <div className={styles.inputGroup} style={{ marginBottom: '16px' }}>
            <label>Action on Submit</label>
            <select value={formData.settings.submission.actionType} onChange={e => updateSetting('submission', 'actionType', e.target.value)} style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
              <option value="message">Show Success Message</option>
              <option value="redirect">Redirect to URL</option>
            </select>
          </div>

          {formData.settings.submission.actionType === 'message' ? (
            <div className={styles.inputGroup} style={{ marginBottom: '16px' }}>
              <label>Success Message</label>
              <textarea value={formData.settings.submission.successMessage} onChange={e => updateSetting('submission', 'successMessage', e.target.value)} rows={3} style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '4px' }} />
            </div>
          ) : (
            <div className={styles.inputGroup} style={{ marginBottom: '16px' }}>
              <label>Redirect URL</label>
              <input type="url" value={formData.settings.submission.redirectUrl} onChange={e => updateSetting('submission', 'redirectUrl', e.target.value)} placeholder="https://yourwebsite.com/thank-you" />
            </div>
          )}

          <div style={{ marginTop: '24px', padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h4 style={{ margin: '0 0 12px 0' }}>Security (Spam Protection)</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="recaptcha" checked={formData.settings.submission.enableRecaptcha} onChange={e => updateSetting('submission', 'enableRecaptcha', e.target.checked)} />
              <label htmlFor="recaptcha">Enable Google reCAPTCHA v3 Validation (Backend key required)</label>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className={styles.mainArea}>
          <h3>Notifications & Automations</h3>
          
          <div style={{ marginBottom: '24px', padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h4 style={{ margin: '0 0 12px 0' }}>Internal Alerts</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="internalAlerts" checked={formData.settings.notifications.internalAlerts} onChange={e => updateSetting('notifications', 'internalAlerts', e.target.checked)} />
              <label htmlFor="internalAlerts">Send CRM notification to the Lead Assignee</label>
            </div>
          </div>

          <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h4 style={{ margin: '0 0 12px 0' }}>Auto-Responder</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <input type="checkbox" id="autoResponder" checked={formData.settings.notifications.autoResponder} onChange={e => updateSetting('notifications', 'autoResponder', e.target.checked)} />
              <label htmlFor="autoResponder">Send an automatic email to the submitter (requires 'email' field)</label>
            </div>
            {formData.settings.notifications.autoResponder && (
              <>
                <div className={styles.inputGroup} style={{ marginBottom: '12px' }}>
                  <label>Subject</label>
                  <input type="text" value={formData.settings.notifications.autoResponderSubject} onChange={e => updateSetting('notifications', 'autoResponderSubject', e.target.value)} />
                </div>
                <div className={styles.inputGroup}>
                  <label>Email Body</label>
                  <textarea value={formData.settings.notifications.autoResponderBody} onChange={e => updateSetting('notifications', 'autoResponderBody', e.target.value)} rows={4} style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '4px' }} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'builder' && (
        <div className={styles.builderContainer} style={{ marginTop: '0' }}>
          <div className={styles.sidebar}>
            <h3>Add Fields</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              {FIELD_TYPES.map(ft => (
                <button 
                  key={ft.type}
                  onClick={() => addField(ft.type)}
                  style={{ padding: '8px', textAlign: 'left', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '4px', cursor: 'pointer' }}
                >
                  + {ft.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className={styles.mainArea}>
            <h3>Form Structure</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>
              Drag and drop functionality can be added later. Configure field logic to create dynamic branching.
            </p>
            
            {formData.fields.map((field, index) => (
              <div key={field.id} className={styles.fieldItem} style={{ borderLeft: field.type === 'step' ? '4px solid #4f46e5' : '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, color: field.type === 'step' ? '#4f46e5' : 'inherit' }}>
                    {field.label} <span style={{ color: '#6b7280', fontSize: '12px', fontWeight: 'normal' }}>({field.type})</span>
                  </h4>
                  <button onClick={() => removeField(field.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}>Remove</button>
                </div>
                
                {field.type !== 'step' && (
                  <div className={styles.fieldConfig}>
                    <div className={styles.inputGroup}>
                      <label>Label</label>
                      <input type="text" value={field.label} onChange={e => updateField(field.id, 'label', e.target.value)} />
                    </div>
                    <div className={styles.inputGroup}>
                      <label>Internal Name (API key)</label>
                      <input type="text" value={field.name} onChange={e => updateField(field.id, 'name', e.target.value)} />
                    </div>
                    
                    {field.type !== 'hidden' && (
                      <div className={styles.inputGroup}>
                        <label>Placeholder</label>
                        <input type="text" value={field.placeholder || ''} onChange={e => updateField(field.id, 'placeholder', e.target.value)} />
                      </div>
                    )}

                    {field.type === 'hidden' && (
                      <div className={styles.inputGroup}>
                        <label>Default Value / UTM Key</label>
                        <input type="text" value={field.placeholder || ''} onChange={e => updateField(field.id, 'placeholder', e.target.value)} placeholder="e.g. utm_source" />
                      </div>
                    )}
                    
                    {field.type !== 'hidden' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                        <input type="checkbox" id={`req-${field.id}`} checked={field.required} onChange={e => updateField(field.id, 'required', e.target.checked)} />
                        <label htmlFor={`req-${field.id}`} style={{ fontSize: '13px' }}>Required Field</label>
                      </div>
                    )}
                    
                    {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
                      <div className={styles.inputGroup} style={{ marginTop: '8px' }}>
                        <label>Options (comma separated)</label>
                        <input 
                          type="text" 
                          value={field.options || ''} 
                          onChange={e => updateField(field.id, 'options', e.target.value)} 
                          placeholder="Option 1, Option 2, Option 3"
                        />
                      </div>
                    )}

                    {/* Conditional Logic UI */}
                    <div style={{ marginTop: '16px', padding: '12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h5 style={{ margin: 0, fontSize: '13px' }}>Conditional Logic</h5>
                        {!field.conditional_logic ? (
                          <button onClick={() => updateFieldLogic(field.id, 'operator', 'equals')} style={{ background: 'none', border: '1px dashed #d1d5db', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>+ Add Logic</button>
                        ) : (
                          <button onClick={() => removeFieldLogic(field.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '12px', cursor: 'pointer' }}>Clear</button>
                        )}
                      </div>
                      
                      {field.conditional_logic && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', fontSize: '13px', color: '#4b5563' }}>Show if</div>
                          <select value={field.conditional_logic.targetField} onChange={e => updateFieldLogic(field.id, 'targetField', e.target.value)} style={{ padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', flex: 1 }}>
                            <option value="">Select Field...</option>
                            {formData.fields.filter(f => f.id !== field.id && f.type !== 'step').map(f => (
                              <option key={f.id} value={f.name}>{f.label} ({f.name})</option>
                            ))}
                          </select>
                          <select value={field.conditional_logic.operator} onChange={e => updateFieldLogic(field.id, 'operator', e.target.value)} style={{ padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px' }}>
                            <option value="equals">Equals</option>
                            <option value="not_equals">Does Not Equal</option>
                            <option value="contains">Contains</option>
                          </select>
                          <input type="text" value={field.conditional_logic.value} onChange={e => updateFieldLogic(field.id, 'value', e.target.value)} placeholder="Value..." style={{ padding: '4px', border: '1px solid #d1d5db', borderRadius: '4px', flex: 1 }} />
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            ))}
            {formData.fields.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280', border: '2px dashed #e5e7eb', borderRadius: '8px' }}>
                Add fields from the left sidebar
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
