/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps, no-unused-vars */
import { useState, useEffect } from 'react';
import layoutStyles from './ConfigLayout.module.css';
import { Button, Input } from '../../components/ui';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';

export default function ConversionChecklistManager() {
  const [checklist, setChecklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newRequired, setNewRequired] = useState(false);
  
  const toast = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/config/tenant-settings');
      const defaultChecklist = [
        { key: 'contract_signed', label: 'Contract signed', required: true, active: true },
        { key: 'booking_received', label: 'Booking amount received', required: true, active: true },
        { key: 'scope_finalized', label: 'Scope frozen', required: true, active: true },
        { key: 'site_visit_completed', label: 'Site visit completed', required: true, active: true },
        { key: 'floor_plan', label: 'Floor plan attached', required: false, active: true },
        { key: 'site_address_confirmed', label: 'Site address confirmed', required: false, active: true }
      ];
      
      const config = res.data?.data?.pre_conversion_checklist || defaultChecklist;
      setChecklist(config);
    } catch (err) {
      toast.error('Failed to load checklist configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = (index) => {
    const updated = [...checklist];
    updated[index].active = !updated[index].active;
    setChecklist(updated);
  };

  const handleToggleRequired = (index) => {
    const updated = [...checklist];
    updated[index].required = !updated[index].required;
    setChecklist(updated);
  };

  const handleLabelChange = (index, val) => {
    const updated = [...checklist];
    updated[index].label = val;
    setChecklist(updated);
  };

  const handleDeleteItem = (index) => {
    const updated = checklist.filter((_, i) => i !== index);
    setChecklist(updated);
  };

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newLabel.trim()) {
      return toast.error('Requirement label cannot be empty.');
    }

    // Generate a unique key based on the label
    const key = `custom_${newLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`;
    
    // Check for duplicates
    if (checklist.some(item => item.key === key)) {
      return toast.error('A requirement with this name already exists.');
    }

    const newItem = {
      key,
      label: newLabel.trim(),
      required: newRequired,
      active: true
    };

    setChecklist([...checklist, newItem]);
    setNewLabel('');
    setNewRequired(false);
    toast.success('Checklist requirement added locally. Save to persist.');
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await api.patch('/config/tenant-settings', {
        pre_conversion_checklist: checklist
      });
      toast.success('Checklist configuration saved successfully!');
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to save checklist configuration.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 flex items-center gap-2">
          <svg className="animate-spin h-5 width-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading checklist settings...
        </div>
      </div>
    );
  }

  return (
    <div className={layoutStyles.configSection}>
      <div className={layoutStyles.sectionHeader}>
        <div>
          <h2 className={layoutStyles.sectionTitle}>Lead-to-Project Conversion Checklist</h2>
          <p className={layoutStyles.sectionDesc}>
            Configure the required and optional checks that must be verified before converting a lead into an active project.
          </p>
        </div>
        <Button 
          variant="primary" 
          onClick={handleSaveSettings} 
          disabled={saving}
          className="shadow-sm"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Active Checklist Requirements</h3>
        
        {checklist.length === 0 ? (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-500">
            No checklist requirements configured. Add some below to enforce gates during conversion.
          </div>
        ) : (
          <div className="grid gap-3">
            {checklist.map((item, idx) => (
              <div 
                key={item.key} 
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border rounded-xl shadow-sm transition-all duration-200 ${item.active ? 'border-gray-200 hover:border-gray-300' : 'border-gray-200 opacity-60 bg-gray-50/50'}`}
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => handleLabelChange(idx, e.target.value)}
                      className="font-medium text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent py-0.5 px-1 text-sm sm:text-base w-full max-w-md transition-colors"
                      placeholder="Requirement Label"
                    />
                    {item.required ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-100">
                        Mandatory
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                        Optional
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 font-mono block select-none">Key: {item.key}</span>
                </div>

                <div className="flex items-center gap-4 mt-3 sm:mt-0 justify-end">
                  {/* Mandatory Toggle */}
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.required}
                      onChange={() => handleToggleRequired(idx)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 transition-colors"
                    />
                    Mandatory
                  </label>

                  {/* Active Toggle */}
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.active}
                      onChange={() => handleToggleActive(idx)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 transition-colors"
                    />
                    Active
                  </label>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteItem(idx)}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-2"
                    title="Remove requirement"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Custom Requirement Form */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mt-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Add Custom Requirement</h3>
        <form onSubmit={handleAddItem} className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4 items-end">
            <div className="sm:col-span-2">
              <Input
                label="Requirement Label"
                placeholder="e.g., Booking token received, Site visit complete"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center gap-4 h-11 justify-between sm:justify-start px-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newRequired}
                  onChange={(e) => setNewRequired(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                Make it Mandatory
              </label>
              
              <Button type="submit" variant="outline" className="w-full sm:w-auto h-10 ml-auto sm:ml-4">
                Add Requirement
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
