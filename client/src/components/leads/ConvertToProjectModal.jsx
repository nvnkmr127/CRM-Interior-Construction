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
    designer: '',
    contractValue: '',
    advanceAmount: '',
    startDate: '',
    handoverDate: '',
    paymentTerms: ''
  });
  
  // Strict checklist logic
  const [checklist, setChecklist] = useState({
    booking_received: false,
    floor_plan: false,
    scope_finalized: false,
    contract_signed: false,
    site_address_confirmed: false
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
        designer: '',
        contractValue: lead.budget_max || '',
        advanceAmount: '',
        startDate: '',
        handoverDate: '',
        paymentTerms: ''
      });
      setChecklist({ booking_received: false, floor_plan: false, scope_finalized: false, contract_signed: false, site_address_confirmed: false });
    }
  }, [isOpen, lead]);

  const fillMockData = () => {
    setFormData({
      projectType: formData.projectType || 'full_interior',
      clientName: formData.clientName || lead?.name || 'Rahul Sharma',
      clientPhone: formData.clientPhone || lead?.phone || '+91 9876543210',
      clientEmail: formData.clientEmail || lead?.email || 'rahul.s@example.com',
      projectName: formData.projectName || (lead?.name ? `${lead.name}'s Project` : 'Rahul - 3BHK Whitefield'),
      pm: formData.pm || 'u1',
      designer: formData.designer || 'u3',
      contractValue: formData.contractValue || lead?.budget_max || '1500000',
      advanceAmount: formData.advanceAmount || '150000',
      startDate: formData.startDate || new Date().toISOString().slice(0, 10),
      handoverDate: formData.handoverDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      paymentTerms: formData.paymentTerms || '10_40_40_10'
    });
    setChecklist({
      booking_received: true,
      floor_plan: true,
      scope_finalized: true,
      contract_signed: true,
      site_address_confirmed: true
    });
  };

  const allChecked = Object.values(checklist).every(v => v === true);

  const handleSubmit = async () => {
    if (!allChecked) {
      return toast.error("Please complete the checklist before converting.");
    }
    if (!formData.projectType || !formData.projectName) {
      return toast.error("Please fill in the required project details.");
    }

    try {
      setLoading(true);
      const payload = {
        ...formData,
        ...checklist
      };
      
      // Send the actual conversion request
      const res = await api.post(`/leads/${lead.id}/convert-to-project`, payload);
      
      if (res.data.success) {
        toast.success('Project successfully created!');
        onClose();
        if (onConverted) onConverted(res.data.data.project_id);
      }
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to convert lead');
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
      size="lg"
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
        {/* Lead Summary Section */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Lead Summary
            </h4>
            <Button variant="outline" size="sm" onClick={fillMockData} className="py-1 h-auto text-xs">Fill Mock Data</Button>
          </div>
          <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
            <div>
              <span className="text-gray-500 block text-xs mb-0.5">Client</span>
              <span className="font-medium text-gray-900">{lead.name || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs mb-0.5">Contact</span>
              <span className="font-medium text-gray-900">{lead.phone || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs mb-0.5">Scope</span>
              <span className="font-medium text-gray-900 capitalize">{(lead.scope || '').replace('_', ' ') || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-xs mb-0.5">Max Budget</span>
              <span className="font-medium text-gray-900">{lead.budget_max ? `₹${Number(lead.budget_max).toLocaleString()}` : 'TBD'}</span>
            </div>
            {lead.locality && (
              <div className="col-span-2">
                <span className="text-gray-500 block text-xs mb-0.5">Locality</span>
                <span className="font-medium text-gray-900">{lead.locality}</span>
              </div>
            )}
          </div>
        </div>

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
            <label className="flex items-center gap-2 text-sm text-blue-800 cursor-pointer">
              <input 
                type="checkbox" 
                checked={checklist.contract_signed} 
                onChange={e => setChecklist(p => ({...p, contract_signed: e.target.checked}))}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-blue-300"
              />
              Signed contract attached
            </label>
            <label className="flex items-center gap-2 text-sm text-blue-800 cursor-pointer">
              <input 
                type="checkbox" 
                checked={checklist.site_address_confirmed} 
                onChange={e => setChecklist(p => ({...p, site_address_confirmed: e.target.checked}))}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-blue-300"
              />
              Site address confirmed
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
            <Select 
              label="Lead Designer" 
              options={[{value:'',label:'Select Designer'}, {value:'u3',label:'Sneha Kapoor'}, {value:'u4',label:'Amit Patel'}]}
              value={formData.designer}
              onChange={v => setFormData({...formData, designer: v})}
            />
            <Select 
              label="Payment Terms" 
              options={[{value:'',label:'Select Terms'}, {value:'10_40_40_10',label:'10% - 40% - 40% - 10%'}, {value:'50_50',label:'50% - 50%'}]}
              value={formData.paymentTerms}
              onChange={v => setFormData({...formData, paymentTerms: v})}
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
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Advance Amount Received (₹)" 
              type="number"
              value={formData.advanceAmount} 
              onChange={e => setFormData({...formData, advanceAmount: e.target.value})} 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Expected Start Date" 
              type="date"
              value={formData.startDate} 
              onChange={e => setFormData({...formData, startDate: e.target.value})} 
            />
            <Input 
              label="Target Handover Date" 
              type="date"
              value={formData.handoverDate} 
              onChange={e => setFormData({...formData, handoverDate: e.target.value})} 
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
