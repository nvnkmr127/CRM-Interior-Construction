import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicFormBySlug } from '../../api/leadForms'; // we'll use standard fetch for multipart
import styles from './PublicLeadFormPage.module.css';

export default function PublicLeadFormPage() {
  const { slug } = useParams();
  const [formConfig, setFormConfig] = useState(null);
  const [formData, setFormData] = useState({});
  const [files, setFiles] = useState({});
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    fetchForm();
  }, [slug]);

  // Extract UTMs on mount and when config loads
  useEffect(() => {
    if (formConfig) {
      const params = new URLSearchParams(window.location.search);
      const utms = {};
      formConfig.fields.filter(f => f.type === 'hidden').forEach(f => {
        const paramValue = params.get(f.placeholder) || params.get(f.name);
        if (paramValue) utms[f.name] = paramValue;
      });
      if (Object.keys(utms).length > 0) {
        setFormData(prev => ({ ...prev, ...utms }));
      }
    }
  }, [formConfig]);

  const fetchForm = async () => {
    try {
      const data = await getPublicFormBySlug(slug);
      if (data.success) {
        setFormConfig(data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Form not found or inactive');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (name, file) => {
    setFiles(prev => ({ ...prev, [name]: file }));
  };

  const evaluateCondition = (logic) => {
    if (!logic || !logic.targetField) return true; // Show if no logic
    const val = formData[logic.targetField] || '';
    switch (logic.operator) {
      case 'equals': return val.toString().toLowerCase() === logic.value.toLowerCase();
      case 'not_equals': return val.toString().toLowerCase() !== logic.value.toLowerCase();
      case 'contains': return val.toString().toLowerCase().includes(logic.value.toLowerCase());
      default: return true;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if there are more steps
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      // Build FormData for multipart
      const submitData = new FormData();
      Object.keys(formData).forEach(key => submitData.append(key, formData[key]));
      Object.keys(files).forEach(key => {
        if (files[key]) submitData.append(key, files[key]);
      });

      // Submit via fetch directly to support multipart
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/public/forms/${slug}/submit`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: submitData
      });
      const data = await res.json();
      
      if (data.success) {
        setSuccess(true);
        setSuccessMessage(data.data.message);
        if (data.data.redirectUrl) {
          setTimeout(() => {
            window.location.href = data.data.redirectUrl;
          }, 2000);
        }
      } else {
        throw new Error(data.error || 'Failed to submit form');
      }
    } catch (err) {
      setError(err.message || 'Failed to submit form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className={styles.loading}>Loading form...</div>;
  if (error && !formConfig) return <div className={styles.errorContainer}>{error}</div>;

  const branding = formConfig.settings?.branding || {};
  const submissionSettings = formConfig.settings?.submission || {};

  // Custom CSS Injection
  const customStyles = `
    :root {
      --primary-color: ${branding.primaryColor || '#4f46e5'};
      --bg-color: ${branding.backgroundColor || '#f3f4f6'};
      --font-family: ${branding.fontFamily || 'Inter, sans-serif'};
    }
    ${branding.customCss || ''}
  `;

  if (success) {
    return (
      <div className={styles.container}>
        <style>{customStyles}</style>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>✓</div>
          <h2>Success!</h2>
          <p>{successMessage}</p>
        </div>
      </div>
    );
  }

  // Parse steps
  const steps = [];
  let currentStepFields = [];
  formConfig.fields.forEach(f => {
    if (f.type === 'step') {
      steps.push(currentStepFields);
      currentStepFields = [];
    } else {
      currentStepFields.push(f);
    }
  });
  if (currentStepFields.length > 0) steps.push(currentStepFields);

  const visibleFields = steps[currentStep] || [];

  return (
    <div className={styles.container}>
      <style>{customStyles}</style>
      <div className={styles.formCard}>
        {branding.logoUrl && (
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <img src={branding.logoUrl} alt="Logo" style={{ maxHeight: '60px', maxWidth: '100%' }} />
          </div>
        )}
        
        <h1 className={styles.title}>{formConfig.name}</h1>
        {formConfig.description && <p className={styles.description}>{formConfig.description}</p>}
        
        {steps.length > 1 && (
          <div className={styles.stepIndicator}>
            Step {currentStep + 1} of {steps.length}
          </div>
        )}

        {error && <div className={styles.errorMessage}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <input type="text" name="website_url" style={{ display: 'none' }} tabIndex="-1" autoComplete="off" onChange={e => handleInputChange('website_url', e.target.value)} />
          
          {submissionSettings.enableRecaptcha && (
            <input type="hidden" name="recaptcha_token" value="dummy_mock_token" onChange={() => {}} />
          )}

          {visibleFields.map(field => {
            if (field.type === 'hidden') return null; // handled via URL or default
            if (!evaluateCondition(field.conditional_logic)) return null;

            return (
              <div key={field.id} className={styles.fieldGroup}>
                <label>
                  {field.label} {field.required && <span className={styles.required}>*</span>}
                </label>
                
                {field.type === 'textarea' ? (
                  <textarea required={field.required} placeholder={field.placeholder} onChange={e => handleInputChange(field.name, e.target.value)} className={styles.input} rows={4} value={formData[field.name] || ''} />
                ) : field.type === 'select' ? (
                  <select required={field.required} onChange={e => handleInputChange(field.name, e.target.value)} className={styles.input} value={formData[field.name] || ''}>
                    <option value="">Select an option</option>
                    {(field.options || '').split(',').map(opt => opt.trim()).filter(Boolean).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.type === 'radio' ? (
                  <div className={styles.radioGroup}>
                    {(field.options || '').split(',').map(opt => opt.trim()).filter(Boolean).map(opt => (
                      <label key={opt} className={styles.radioLabel}>
                        <input type="radio" name={field.name} value={opt} required={field.required} onChange={e => handleInputChange(field.name, e.target.value)} checked={formData[field.name] === opt} />
                        {opt}
                      </label>
                    ))}
                  </div>
                ) : field.type === 'checkbox' ? (
                  <div className={styles.radioGroup}>
                    {(field.options || '').split(',').map(opt => opt.trim()).filter(Boolean).map(opt => (
                      <label key={opt} className={styles.radioLabel}>
                        <input type="checkbox" name={field.name} value={opt} onChange={e => {
                          const currentValues = formData[field.name] ? formData[field.name].split(',') : [];
                          let newValues;
                          if (e.target.checked) newValues = [...currentValues, opt];
                          else newValues = currentValues.filter(v => v !== opt);
                          handleInputChange(field.name, newValues.join(','));
                        }} checked={(formData[field.name] || '').includes(opt)} />
                        {opt}
                      </label>
                    ))}
                  </div>
                ) : field.type === 'file' ? (
                   <input type="file" required={field.required} onChange={e => handleFileChange(field.name, e.target.files[0])} className={styles.input} />
                ) : (
                  <input type={field.type === 'phone' ? 'tel' : field.type} required={field.required} placeholder={field.placeholder} onChange={e => handleInputChange(field.name, e.target.value)} className={styles.input} value={formData[field.name] || ''} />
                )}
              </div>
            );
          })}

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            {currentStep > 0 && (
              <button type="button" onClick={() => setCurrentStep(prev => prev - 1)} className={styles.secondaryBtn}>
                Back
              </button>
            )}
            <button type="submit" disabled={isSubmitting} className={styles.submitBtn}>
              {isSubmitting ? 'Processing...' : (currentStep < steps.length - 1 ? 'Next' : (submissionSettings.buttonText || 'Submit'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
