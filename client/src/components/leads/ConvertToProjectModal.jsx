import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Select } from '../ui';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';
import { useS3Upload } from '../../hooks/useS3Upload';

const PROJECT_TYPES = [
  { id: 'full_interior', label: 'Full Interior' },
  { id: 'modular_kitchen', label: 'Modular Kitchen' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'turnkey', label: 'Turnkey' }
];

export default function ConvertToProjectModal({ lead, isOpen, onClose, onConverted }) {
  const toast = useToast();
  const { uploadContract, uploading, progress } = useS3Upload();
  const [loading, setLoading] = useState(false);
  const [contractFile, setContractFile] = useState(null);
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
    paymentTerms: '',
    agreement_signed_by: '',
    agreement_signed_at: '',
    agreement_signature_method: ''
  });
  
  // Dynamic checklist logic
  const [checklistConfig, setChecklistConfig] = useState([]);
  const [checklist, setChecklist] = useState({});
  const [loadingConfig, setLoadingConfig] = useState(true);

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
        paymentTerms: '',
        agreement_signed_by: lead.name || '',
        agreement_signed_at: new Date().toISOString().slice(0, 10),
        agreement_signature_method: 'digital'
      });
      setContractFile(null);

      const loadChecklistConfig = async () => {
        try {
          setLoadingConfig(true);
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
          const activeItems = config.filter(item => item.active);
          setChecklistConfig(activeItems);

          const initialChecklist = {};
          activeItems.forEach(item => {
            initialChecklist[item.key] = false;
          });
          setChecklist(initialChecklist);
        } catch (err) {
          console.error('Failed to load checklist config', err);
          const fallback = [
            { key: 'contract_signed', label: 'Contract signed', required: true, active: true },
            { key: 'booking_received', label: 'Booking amount received', required: true, active: true },
            { key: 'scope_finalized', label: 'Scope frozen', required: true, active: true },
            { key: 'site_visit_completed', label: 'Site visit completed', required: true, active: true },
            { key: 'floor_plan', label: 'Floor plan attached', required: false, active: true },
            { key: 'site_address_confirmed', label: 'Site address confirmed', required: false, active: true }
          ];
          setChecklistConfig(fallback);
          const initialChecklist = {};
          fallback.forEach(item => {
            initialChecklist[item.key] = false;
          });
          setChecklist(initialChecklist);
        } finally {
          setLoadingConfig(false);
        }
      };

      loadChecklistConfig();
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
      paymentTerms: formData.paymentTerms || '10_40_40_10',
      agreement_signed_by: formData.agreement_signed_by || lead?.name || 'Rahul Sharma',
      agreement_signed_at: formData.agreement_signed_at || new Date().toISOString().slice(0, 10),
      agreement_signature_method: formData.agreement_signature_method || 'digital'
    });
    setContractFile(new File(['mock contract content'], 'signed_contract.pdf', { type: 'application/pdf' }));
    
    const mockedChecklist = {};
    checklistConfig.forEach(item => {
      mockedChecklist[item.key] = true;
    });
    setChecklist(mockedChecklist);
  };

  const allChecked = checklistConfig.every(item => !item.required || checklist[item.key] === true);

  const handleSubmit = async () => {
    if (!allChecked) {
      return toast.error("Please complete the checklist before converting.");
    }
    if (!formData.projectType || !formData.projectName) {
      return toast.error("Please fill in the required project details.");
    }
    if (!contractFile) {
      return toast.error("Signed contract document is required.");
    }

    try {
      setLoading(true);
      const uploadedFile = await uploadContract({ file: contractFile });
      
      const payload = {
        ...formData,
        ...checklist,
        contract_file_key: uploadedFile.storageKey,
        contract_file_name: uploadedFile.fileName,
        contract_file_size: uploadedFile.fileSize,
        contract_file_mime: uploadedFile.mimeType
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
          {loadingConfig ? (
            <div className="text-sm text-blue-600">Loading checklist...</div>
          ) : (
            <div className="space-y-2">
              {checklistConfig.map(item => (
                <label key={item.key} className="flex items-center gap-2 text-sm text-blue-800 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={!!checklist[item.key]} 
                    onChange={e => setChecklist(p => ({...p, [item.key]: e.target.checked}))}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-blue-300"
                  />
                  <span>
                    {item.label}
                    {item.required && <span className="text-red-500 ml-1 font-bold" title="Mandatory requirement">*</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
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
              options={[{value:'',label:'Select Terms'}, {value:'10_40_40_10',label:'10% - 40% - 40% - 10%'}, {value:'30_30_30_10',label:'30% - 30% - 30% - 10%'}, {value:'50_50',label:'50% - 50%'}]}
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
          <div className="grid grid-cols-3 gap-4">
            <Input 
              label="Agreement Signed By" 
              value={formData.agreement_signed_by} 
              onChange={e => setFormData({...formData, agreement_signed_by: e.target.value})} 
            />
            <Input 
              label="Agreement Signed Date" 
              type="date"
              value={formData.agreement_signed_at} 
              onChange={e => setFormData({...formData, agreement_signed_at: e.target.value})} 
            />
            <Select 
              label="Signature Method" 
              options={[{value:'',label:'Select Method'}, {value:'digital',label:'Digital'}, {value:'physical',label:'Physical'}]}
              value={formData.agreement_signature_method}
              onChange={v => setFormData({...formData, agreement_signature_method: v})}
            />
          </div>
          
          {/* Contract File Section */}
          <div className="space-y-2 mt-4 border-t border-gray-100 pt-4">
            <label className="block text-sm font-semibold text-gray-700">Signed Contract Document *</label>
            <div className="flex items-center gap-4">
              <input 
                type="file" 
                accept=".pdf,.png,.jpg,.jpeg" 
                onChange={e => setContractFile(e.target.files[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
              {uploading && (
                <span className="text-xs text-blue-600 font-medium whitespace-nowrap">Uploading ({progress}%)...</span>
              )}
            </div>
            {contractFile && (
              <p className="text-xs text-gray-500 mt-1">Selected file: <span className="font-semibold text-gray-700">{contractFile.name}</span> ({(contractFile.size / 1024).toFixed(1)} KB)</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
