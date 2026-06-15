import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { createLead, updateLead } from '../../api/leads';

export default function LeadForm({ lead, onSave, onClose }) {
  const isEdit = !!lead;

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    source: '',
    stageId: '',
    assigneeId: '',
    notes: '',
    custom_fields: {}
  });

  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);
  const [customFieldsConfig, setCustomFieldsConfig] = useState([]);
  
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchDeps = async () => {
      try {
        const [stagesRes, fieldsRes, usersRes] = await Promise.all([
          api.get('/config/lead-stages').catch(() => ({ data: { data: [] } })),
          api.get('/config/custom-fields?entity=lead').catch(() => ({ data: { data: [] } })),
          api.get('/users').catch(() => ({ data: { data: [] } })) 
        ]);
        
        if (stagesRes.data.success) setStages(stagesRes.data.data);
        if (fieldsRes.data.success) setCustomFieldsConfig(fieldsRes.data.data);
        if (usersRes.data?.success) setUsers(usersRes.data.data);
      } catch (err) {
        console.error('Failed to load form dependencies', err);
      }
    };
    fetchDeps();

    if (lead) {
      setFormData({
        name: lead.name || '',
        phone: lead.phone || '',
        email: lead.email || '',
        source: lead.source || '',
        stageId: lead.stage_id || '',
        assigneeId: lead.assignee_id || '',
        notes: lead.notes || '',
        custom_fields: lead.custom_fields || {}
      });
    }
  }, [lead]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const handleCustomFieldChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      custom_fields: {
        ...prev.custom_fields,
        [key]: value
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      const payload = { ...formData };
      if (!payload.stageId) delete payload.stageId;
      if (!payload.assigneeId) delete payload.assigneeId;

      let res;
      if (isEdit) {
        res = await updateLead(lead.id, payload);
      } else {
        res = await createLead(payload);
      }

      if (res.success) {
        onSave && onSave(res.data);
      }
    } catch (err) {
      if (err.response?.data?.error?.issues) {
        const newErrors = {};
        err.response.data.error.issues.forEach(issue => {
          const path = issue.path.join('.');
          newErrors[path] = issue.message;
        });
        setErrors(newErrors);
      } else if (err.response?.data?.error?.code === 'STAGE_GATE_FAILED') {
         setErrors({ general: `Stage Gate Failed: Missing ${err.response.data.error.missing.join(', ')}` });
      } else {
        setErrors({ general: err.response?.data?.error?.message || 'An error occurred' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden transform transition-all">
        
        <div className="flex justify-between items-center p-5 border-b border-gray-200 bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">
            {isEdit ? 'Edit Lead' : 'Create New Lead'}
          </h2>
          <button 
            onClick={onClose} 
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {errors.general && (
            <div className="mb-5 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded shadow-sm flex items-start">
              <svg className="w-5 h-5 mr-2 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              {errors.general}
            </div>
          )}

          <form id="lead-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Standard Fields */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Primary Info</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700">Name <span className="text-red-500">*</span></label>
                  <input 
                    type="text" name="name" 
                    value={formData.name} onChange={handleChange}
                    placeholder="E.g. John Doe"
                    className={`mt-1.5 block w-full rounded-md border p-2.5 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${errors.name ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1 font-medium">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700">Phone <span className="text-red-500">*</span></label>
                  <input 
                    type="text" name="phone" 
                    value={formData.phone} onChange={handleChange}
                    placeholder="+1 234 567 8900"
                    className={`mt-1.5 block w-full rounded-md border p-2.5 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${errors.phone ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1 font-medium">{errors.phone}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700">Email</label>
                  <input 
                    type="email" name="email" 
                    value={formData.email} onChange={handleChange}
                    placeholder="john@example.com"
                    className="mt-1.5 block w-full rounded-md border border-gray-300 p-2.5 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1 font-medium">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700">Source</label>
                  <select 
                    name="source" 
                    value={formData.source} onChange={handleChange}
                    className="mt-1.5 block w-full rounded-md border border-gray-300 p-2.5 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
                  >
                    <option value="">Select source</option>
                    <option value="website">Website</option>
                    <option value="facebook">Facebook</option>
                    <option value="indimart">IndiaMART</option>
                    <option value="referral">Referral</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Status & Assignment</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700">Stage</label>
                  <select 
                    name="stageId" 
                    value={formData.stageId} onChange={handleChange}
                    className="mt-1.5 block w-full rounded-md border border-gray-300 p-2.5 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
                  >
                    <option value="">Select stage</option>
                    {stages.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {errors.stageId && <p className="text-red-500 text-xs mt-1 font-medium">{errors.stageId}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700">Assignee</label>
                  <select 
                    name="assigneeId" 
                    value={formData.assigneeId} onChange={handleChange}
                    className="mt-1.5 block w-full rounded-md border border-gray-300 p-2.5 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
                  >
                    <option value="">Unassigned</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700">Notes</label>
              <textarea 
                name="notes" rows="3"
                value={formData.notes} onChange={handleChange}
                placeholder="Enter any initial notes or background context..."
                className="mt-1.5 block w-full rounded-md border border-gray-300 p-2.5 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              ></textarea>
            </div>

            {/* Custom Fields */}
            {customFieldsConfig.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Additional Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  {customFieldsConfig.map(field => {
                    const errorMsg = errors[`custom_fields.${field.field_key}`];
                    return (
                      <div key={field.id}>
                        <label className="block text-sm font-semibold text-gray-700">
                          {field.field_label} {field.is_required && <span className="text-red-500">*</span>}
                        </label>
                        {field.field_type === 'dropdown' ? (
                          <select
                            value={formData.custom_fields[field.field_key] || ''}
                            onChange={(e) => handleCustomFieldChange(field.field_key, e.target.value)}
                            className="mt-1.5 block w-full rounded-md border border-gray-300 p-2.5 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
                          >
                            <option value="">Select...</option>
                            {field.options?.map(o => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                        ) : field.field_type === 'boolean' ? (
                          <label className="mt-2.5 flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={!!formData.custom_fields[field.field_key]}
                              onChange={(e) => handleCustomFieldChange(field.field_key, e.target.checked)}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-600">Yes</span>
                          </label>
                        ) : field.field_type === 'date' ? (
                          <input
                            type="date"
                            value={formData.custom_fields[field.field_key] || ''}
                            onChange={(e) => handleCustomFieldChange(field.field_key, e.target.value)}
                            className="mt-1.5 block w-full rounded-md border border-gray-300 p-2.5 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          />
                        ) : field.field_type === 'number' ? (
                          <input
                            type="number"
                            value={formData.custom_fields[field.field_key] || ''}
                            onChange={(e) => handleCustomFieldChange(field.field_key, Number(e.target.value))}
                            className="mt-1.5 block w-full rounded-md border border-gray-300 p-2.5 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          />
                        ) : (
                          <input
                            type="text"
                            value={formData.custom_fields[field.field_key] || ''}
                            onChange={(e) => handleCustomFieldChange(field.field_key, e.target.value)}
                            className={`mt-1.5 block w-full rounded-md border p-2.5 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${errorMsg ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                          />
                        )}
                        {errorMsg && <p className="text-red-500 text-xs mt-1 font-medium">{errorMsg}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
          <button 
            type="button" onClick={onClose} disabled={isSubmitting}
            className="px-5 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-gray-200"
          >
            Cancel
          </button>
          <button 
            type="submit" form="lead-form" disabled={isSubmitting}
            className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 flex items-center justify-center min-w-[100px]"
          >
            {isSubmitting ? (
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              'Save Lead'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
