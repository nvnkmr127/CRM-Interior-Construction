import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Select } from '../ui';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';

const PROJECT_TYPES = [
  { id: 'full_interior', label: 'Full Interior' },
  { id: 'modular_kitchen', label: 'Modular Kitchen' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'turnkey', label: 'Turnkey' }
];

export default function ConvertToProjectModal({ lead, isOpen, onClose, onConverted }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    projectType: '',
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    projectName: '',
    pm: '',
    contractValue: ''
  });
  
  // Strict checklist logic
  const [checklist, setChecklist] = useState({
    booking_received: false,
    floor_plan: false,
    scope_finalized: false
  });

  useEffect(() => {
    if (isOpen && lead) {
      setFormData({
        projectType: lead.scope === 'full_home' ? 'full_interior' : (lead.scope === 'modular_kitchen' ? 'modular_kitchen' : ''),
        clientName: lead.name || '',
        clientPhone: lead.phone || '',
        clientEmail: lead.email || '',
        projectName: lead.name ? `${lead.name}'s Project` : '',
        pm: '',
        contractValue: lead.budget_max || ''
      });
      setChecklist({ booking_received: false, floor_plan: false, scope_finalized: false });
    }
  }, [isOpen, lead]);

  const allChecked = Object.values(checklist).every(v => v === true);

  const handleSubmit = async () => {
    if (!allChecked) {
      return toast.error("Please complete the checklist before converting.");
    }
    if (!formData.projectType || !formData.projectName || !formData.pm) {
      return toast.error("Please fill in the required project details.");
    }
    
    setLoading(true);
    try {
      const payload = {
        ...formData,
        ...checklist
      };
      const res = await api.post(`/leads/${lead.id}/convert-to-project`, payload);
      if (res.data.success) {
        toast.success('Project successfully created!');
        onClose();
        if (onConverted) onConverted(res.data.data.project_id);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to convert lead');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !lead) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Convert Lead to Project"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={loading || !allChecked}>
            {loading ? 'Creating...' : 'Create Project'}
          </Button>
        </>
      }
    >
      <div className="space-y-6 pb-2">
        {/* Checklist Section */}
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-md">
          <h4 className="font-semibold text-blue-900 mb-3 text-sm">Pre-Conversion Checklist</h4>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-blue-800 cursor-pointer">
              <input 
                type="checkbox" 
                checked={checklist.booking_received} 
                onChange={e => setChecklist(p => ({...p, booking_received: e.target.checked}))}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-blue-300"
              />
              Booking amount received
            </label>
            <label className="flex items-center gap-2 text-sm text-blue-800 cursor-pointer">
              <input 
                type="checkbox" 
                checked={checklist.floor_plan} 
                onChange={e => setChecklist(p => ({...p, floor_plan: e.target.checked}))}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-blue-300"
              />
              Floor plan attached
            </label>
            <label className="flex items-center gap-2 text-sm text-blue-800 cursor-pointer">
              <input 
                type="checkbox" 
                checked={checklist.scope_finalized} 
                onChange={e => setChecklist(p => ({...p, scope_finalized: e.target.checked}))}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-blue-300"
              />
              Scope finalized
            </label>
          </div>
        </div>

        {/* Form Section */}
        <div className="space-y-4">
          <Input 
            label="Project Name *" 
            value={formData.projectName} 
            onChange={e => setFormData({...formData, projectName: e.target.value})} 
          />
          <div className="grid grid-cols-2 gap-4">
            <Select 
              label="Project Type *" 
              options={[{value:'',label:'Select Type'}, ...PROJECT_TYPES.map(t => ({value:t.id, label:t.label}))]}
              value={formData.projectType}
              onChange={v => setFormData({...formData, projectType: v})}
            />
            <Select 
              label="Project Manager *" 
              options={[{value:'',label:'Select PM'}, {value:'u1',label:'Priya Sharma'}, {value:'u2',label:'Rahul Desai'}]}
              value={formData.pm}
              onChange={v => setFormData({...formData, pm: v})}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Client Name" 
              value={formData.clientName} 
              onChange={e => setFormData({...formData, clientName: e.target.value})} 
            />
            <Input 
              label="Estimated Value (₹)" 
              type="number"
              value={formData.contractValue} 
              onChange={e => setFormData({...formData, contractValue: e.target.value})} 
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
