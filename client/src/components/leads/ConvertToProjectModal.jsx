/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
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
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'co_owner',
    decision_authority: 'Influencer',
    relationship_notes: ''
  });
  const [newRoomMeasurement, setNewRoomMeasurement] = useState({
    room_name: '',
    length: '',
    width: '',
    height: '',
    area: '',
    unit: 'feet',
    notes: ''
  });

  const handleNewRoomChange = (field, value) => {
    setNewRoomMeasurement(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'length' || field === 'width') {
        const l = parseFloat(field === 'length' ? value : prev.length) || 0;
        const w = parseFloat(field === 'width' ? value : prev.width) || 0;
        if (l > 0 && w > 0) {
          updated.area = (l * w).toFixed(2);
        }
      }
      return updated;
    });
  };

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
    agreement_signature_method: '',
    flat_number: '',
    floor: '',
    building_name: '',
    street: '',
    city: '',
    pincode: '',
    landmark: '',
    latitude: '',
    longitude: '',
    builder_name: '',
    society_name: '',
    rera_id: '',
    noc_status: 'pending',
    occupancy_certificate_status: 'pending',
    property_handover_date: '',
    contacts: [],
    carpet_area: '',
    built_up_area: '',
    number_of_rooms: '',
    project_category: '',
    project_sub_category: '',
    property_type: '',
    property_age: '',
    renovation_scope: '',
    segment: '',
    measurements: [],
    vendors: [],
    consultants: []
  });
  
  const [newVendor, setNewVendor] = useState({
    vendor_name: '',
    scope_of_work: '',
    agreed_rate: '',
    payment_terms: '',
    status: 'pending'
  });

  const [newConsultant, setNewConsultant] = useState({
    name: '',
    role: 'structural_engineer',
    firm: '',
    email: '',
    phone: ''
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
        agreement_signature_method: 'digital',
        flat_number: '',
        floor: '',
        building_name: '',
        street: lead.locality || '',
        city: '',
        pincode: '',
        landmark: '',
        latitude: '',
        longitude: '',
        builder_name: '',
        society_name: '',
        rera_id: '',
        noc_status: 'pending',
        occupancy_certificate_status: 'pending',
        property_handover_date: '',
        contacts: [],
        carpet_area: '',
        built_up_area: '',
        number_of_rooms: '',
        project_category: '',
        project_sub_category: '',
        property_type: '',
        property_age: '',
        renovation_scope: '',
        segment: '',
        measurements: [],
        vendors: [],
        consultants: []
      });
      setContractFile(null);

      const loadLeadMeasurements = async () => {
        try {
          const res = await api.get(`/leads/${lead.id}/measurements`);
          if (res.data && res.data.success && Array.isArray(res.data.data)) {
            setFormData(prev => ({
              ...prev,
              measurements: res.data.data
            }));
          }
        } catch (err) {
          console.error('Failed to load lead measurements', err);
        }
      };

      loadLeadMeasurements();

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
      agreement_signature_method: formData.agreement_signature_method || 'digital',
      flat_number: 'Flat 405',
      floor: '4',
      building_name: 'Silver Oak Apartments',
      street: lead?.locality || '12th Main Road, Sector 6',
      city: 'Bengaluru',
      pincode: '560102',
      landmark: 'Near HDFC Bank',
      latitude: '12.934533',
      longitude: '77.624102',
      builder_name: 'Prestige Group',
      society_name: 'Prestige Lakeside Habitat',
      rera_id: 'PRM/KA/RERA/1251/446/PR/170915/000123',
      noc_status: 'approved',
      occupancy_certificate_status: 'received',
      contacts: [
        { name: 'Dr. John Doe', phone: '9988776655', email: 'john.d@example.com', role: 'spouse', decision_authority: 'Primary', relationship_notes: 'Spouse — will co-approve designs' },
        { name: 'Ar. Sneha Roy', phone: '9900881122', email: 'sneha@royarchitects.com', role: 'architect', decision_authority: 'Consultant', relationship_notes: 'Client architect coordinating site visits' }
      ],
      carpet_area: '1200',
      built_up_area: '1500',
      number_of_rooms: '4',
      project_category: 'residential',
      project_sub_category: 'apartment',
      property_type: 'owned',
      property_age: 'new',
      renovation_scope: 'none',
      segment: 'luxury',
      vendors: [
        { vendor_name: 'Balaji Marbles', scope_of_work: 'Marble flooring', agreed_rate: 75000, payment_terms: '50-50', status: 'active' }
      ],
      consultants: [
        { name: 'Dr. H. C. Verma', role: 'structural_engineer', firm: 'Verma Structs', email: 'verma@struct.com', phone: '9876543210' }
      ],
      measurements: [
        { room_name: 'Living Room', length: 15, width: 12, height: 10, area: 180, unit: 'feet', notes: 'Main entrance area' },
        { room_name: 'Master Bedroom', length: 14, width: 12, height: 10, area: 168, unit: 'feet', notes: 'East wall needs extra sockets' }
      ]
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
          
          {/* Structured address fields */}
          <div className="border-t border-gray-100 pt-4">
            <h5 className="font-semibold text-gray-800 text-sm mb-3">Site Address Details</h5>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Input 
                label="Flat / Unit No" 
                placeholder="e.g. 502"
                value={formData.flat_number} 
                onChange={e => setFormData({...formData, flat_number: e.target.value})} 
              />
              <Input 
                label="Floor" 
                placeholder="e.g. 5"
                value={formData.floor} 
                onChange={e => setFormData({...formData, floor: e.target.value})} 
              />
              <Input 
                label="Building Name" 
                placeholder="e.g. Oakridge Heights"
                value={formData.building_name} 
                onChange={e => setFormData({...formData, building_name: e.target.value})} 
              />
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="col-span-2">
                <Input 
                  label="Street Address" 
                  placeholder="e.g. 1st Cross, Banjara Hills"
                  value={formData.street} 
                  onChange={e => setFormData({...formData, street: e.target.value})} 
                />
              </div>
              <Input 
                label="Landmark" 
                placeholder="e.g. Opposite ICICI Bank"
                value={formData.landmark} 
                onChange={e => setFormData({...formData, landmark: e.target.value})} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input 
                label="City" 
                placeholder="e.g. Hyderabad"
                value={formData.city} 
                onChange={e => setFormData({...formData, city: e.target.value})} 
              />
              <Input 
                label="Pincode" 
                placeholder="e.g. 500034"
                value={formData.pincode} 
                onChange={e => setFormData({...formData, pincode: e.target.value})} 
              />
            </div>
            <div className="grid grid-cols-3 gap-4 items-end">
              <Input 
                label="Latitude" 
                placeholder="e.g. 17.4126"
                value={formData.latitude} 
                onChange={e => setFormData({...formData, latitude: e.target.value})} 
              />
              <Input 
                label="Longitude" 
                placeholder="e.g. 78.4354"
                value={formData.longitude} 
                onChange={e => setFormData({...formData, longitude: e.target.value})} 
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  if (!navigator.geolocation) {
                    toast.error('Geolocation is not supported by your browser');
                    return;
                  }
                  navigator.geolocation.getCurrentPosition(
                    position => {
                      setFormData(prev => ({
                        ...prev,
                        latitude: position.coords.latitude.toFixed(6),
                        longitude: position.coords.longitude.toFixed(6)
                      }));
                      toast.success('Coordinates retrieved successfully!');
                    },
                    error => {
                      toast.error('Failed to get location: ' + error.message);
                    }
                  );
                }} 
                className="h-[38px] flex items-center justify-center gap-1 text-xs"
              >
                📍 Get Location
              </Button>
            </div>
          </div>

          {/* Site, Builder & Society Details */}
          <div className="border-t border-gray-100 pt-4">
            <h5 className="font-semibold text-gray-800 text-sm mb-3">Site, Builder & NOC Details</h5>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Input 
                label="Builder Name" 
                placeholder="e.g. Prestige Group"
                value={formData.builder_name} 
                onChange={e => setFormData({...formData, builder_name: e.target.value})} 
              />
              <Input 
                label="Society Name" 
                placeholder="e.g. Prestige Lakeside Habitat"
                value={formData.society_name} 
                onChange={e => setFormData({...formData, society_name: e.target.value})} 
              />
              <Input 
                label="RERA ID" 
                placeholder="e.g. PRM/KA/RERA/..."
                value={formData.rera_id} 
                onChange={e => setFormData({...formData, rera_id: e.target.value})} 
              />
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Select 
                label="Builder NOC Status" 
                options={[
                  { value: 'pending', label: 'Pending' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'not_required', label: 'Not Required' }
                ]}
                value={formData.noc_status}
                onChange={v => setFormData({...formData, noc_status: v})}
              />
              <Select 
                label="Occupancy Certificate" 
                options={[
                  { value: 'pending', label: 'Pending' },
                  { value: 'received', label: 'Received' },
                  { value: 'not_required', label: 'Not Required' }
                ]}
                value={formData.occupancy_certificate_status}
                onChange={v => setFormData({...formData, occupancy_certificate_status: v})}
              />
              <Input 
                label="Property Handover Date" 
                type="date"
                value={formData.property_handover_date} 
                onChange={e => setFormData({...formData, property_handover_date: e.target.value})} 
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input 
                label="Carpet Area (sq ft)" 
                type="number"
                placeholder="e.g. 1200"
                value={formData.carpet_area} 
                onChange={e => setFormData({...formData, carpet_area: e.target.value})} 
              />
              <Input 
                label="Built-up Area (sq ft)" 
                type="number"
                placeholder="e.g. 1500"
                value={formData.built_up_area} 
                onChange={e => setFormData({...formData, built_up_area: e.target.value})} 
              />
              <Input 
                label="Number of Rooms" 
                type="number"
                placeholder="e.g. 4"
                value={formData.number_of_rooms} 
                onChange={e => setFormData({...formData, number_of_rooms: e.target.value})} 
              />
            </div>
          </div>

          {/* Project Classification & Nature */}
          <div className="border-t border-gray-100 pt-4">
            <h5 className="font-semibold text-gray-800 text-sm mb-3">Project Classification & Nature</h5>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Select 
                label="Project Category" 
                options={[
                  { value: '', label: 'Select Category' },
                  { value: 'residential', label: 'Residential' },
                  { value: 'commercial', label: 'Commercial' },
                  { value: 'other', label: 'Other' }
                ]}
                value={formData.project_category}
                onChange={v => setFormData({...formData, project_category: v})}
              />
              <Select 
                label="Project Sub-Category" 
                options={[
                  { value: '', label: 'Select Sub-Category' },
                  { value: 'apartment', label: 'Apartment' },
                  { value: 'villa', label: 'Villa' },
                  { value: 'independent_house', label: 'Independent House' },
                  { value: 'office', label: 'Office' },
                  { value: 'retail', label: 'Retail' },
                  { value: 'hospitality', label: 'Hospitality' },
                  { value: 'other', label: 'Other' }
                ]}
                value={formData.project_sub_category}
                onChange={v => setFormData({...formData, project_sub_category: v})}
              />
              <Select 
                label="Ownership Type" 
                options={[
                  { value: '', label: 'Select Ownership' },
                  { value: 'owned', label: 'Owned' },
                  { value: 'rented', label: 'Rented' }
                ]}
                value={formData.property_type}
                onChange={v => setFormData({...formData, property_type: v})}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Select 
                label="Property Age" 
                options={[
                  { value: '', label: 'Select Property Age' },
                  { value: 'new', label: 'New / Under Construction' },
                  { value: '1-5_years', label: '1 - 5 Years' },
                  { value: '5-10_years', label: '5 - 10 Years' },
                  { value: '10+_years', label: '10+ Years' }
                ]}
                value={formData.property_age}
                onChange={v => setFormData({...formData, property_age: v})}
              />
              <Select 
                label="Renovation Scope" 
                options={[
                  { value: '', label: 'Select Renovation Scope' },
                  { value: 'full', label: 'Full Renovation' },
                  { value: 'partial', label: 'Partial Renovation' },
                  { value: 'none', label: 'New Handover Fit-out (None)' }
                ]}
                value={formData.renovation_scope}
                onChange={v => setFormData({...formData, renovation_scope: v})}
              />
              <Select 
                label="Market Segment" 
                options={[
                  { value: '', label: 'Select Segment' },
                  { value: 'budget', label: 'Budget' },
                  { value: 'standard', label: 'Standard' },
                  { value: 'premium', label: 'Premium' },
                  { value: 'luxury', label: 'Luxury' }
                ]}
                value={formData.segment}
                onChange={v => setFormData({...formData, segment: v})}
              />
            </div>
          </div>

          {/* Site Measurements & Room Dimensions */}
          <div className="border-t border-gray-100 pt-4">
            <h5 className="font-semibold text-gray-800 text-sm mb-3">Site Measurements & Room Dimensions</h5>
            
            {/* Render list of added room measurements */}
            {formData.measurements && formData.measurements.length > 0 ? (
              <div className="space-y-2 mb-4">
                {formData.measurements.map((room, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div>
                      <span className="font-semibold text-gray-800 text-sm">{room.room_name}</span>
                      <div className="text-xs text-gray-500 mt-1">
                        Dimensions: <span className="font-medium text-gray-700">{room.length} x {room.width} x {room.height} {room.unit}</span>
                        {room.area && <> | Area: <span className="font-medium text-gray-700">{room.area} sq {room.unit}</span></>}
                        {room.notes && ` | Notes: ${room.notes}`}
                      </div>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => {
                        const updated = formData.measurements.filter((_, i) => i !== idx);
                        setFormData({ ...formData, measurements: updated });
                      }}
                      className="text-red-500 hover:text-red-700 py-1 h-auto text-xs"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center text-gray-500 text-sm mb-4">
                No room measurements recorded yet.
              </div>
            )}

            {/* Form to add a new room measurement */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Add Room Measurement</div>
              <div className="grid grid-cols-4 gap-4">
                <Input 
                  label="Room Name" 
                  placeholder="e.g. Master Bedroom"
                  value={newRoomMeasurement.room_name}
                  onChange={e => handleNewRoomChange('room_name', e.target.value)}
                />
                <Input 
                  label="Length" 
                  type="number"
                  placeholder="e.g. 12"
                  value={newRoomMeasurement.length}
                  onChange={e => handleNewRoomChange('length', e.target.value)}
                />
                <Input 
                  label="Width" 
                  type="number"
                  placeholder="e.g. 10"
                  value={newRoomMeasurement.width}
                  onChange={e => handleNewRoomChange('width', e.target.value)}
                />
                <Input 
                  label="Height" 
                  type="number"
                  placeholder="e.g. 9.5"
                  value={newRoomMeasurement.height}
                  onChange={e => handleNewRoomChange('height', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-4 gap-4 items-end">
                <Input 
                  label="Area" 
                  type="number"
                  placeholder="e.g. 120"
                  value={newRoomMeasurement.area}
                  onChange={e => handleNewRoomChange('area', e.target.value)}
                />
                <Select 
                  label="Unit" 
                  options={[
                    { value: 'feet', label: 'Feet' },
                    { value: 'meters', label: 'Meters' }
                  ]}
                  value={newRoomMeasurement.unit}
                  onChange={v => handleNewRoomChange('unit', v)}
                />
                <div className="col-span-2 flex gap-4 items-end">
                  <div className="flex-1">
                    <Input 
                      label="Notes" 
                      placeholder="e.g. Extra point socket required on east wall"
                      value={newRoomMeasurement.notes}
                      onChange={e => handleNewRoomChange('notes', e.target.value)}
                    />
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      if (!newRoomMeasurement.room_name || newRoomMeasurement.room_name.trim() === '') {
                        toast.error('Room name is required');
                        return;
                      }
                      setFormData(prev => ({
                        ...prev,
                        measurements: [...(prev.measurements || []), { 
                          room_name: newRoomMeasurement.room_name.trim(),
                          length: newRoomMeasurement.length ? Number(newRoomMeasurement.length) : 0,
                          width: newRoomMeasurement.width ? Number(newRoomMeasurement.width) : 0,
                          height: newRoomMeasurement.height ? Number(newRoomMeasurement.height) : 0,
                          area: newRoomMeasurement.area ? Number(newRoomMeasurement.area) : 0,
                          unit: newRoomMeasurement.unit,
                          notes: newRoomMeasurement.notes ? newRoomMeasurement.notes.trim() : ''
                        }]
                      }));
                      setNewRoomMeasurement({
                        room_name: '',
                        length: '',
                        width: '',
                        height: '',
                        area: '',
                        unit: 'feet',
                        notes: ''
                      });
                    }}
                    className="h-[36px] py-1 text-xs"
                  >
                    Add Room
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Project Stakeholders */}
          <div className="border-t border-gray-100 pt-4">
            <h5 className="font-semibold text-gray-800 text-sm mb-3">Project Stakeholders & Contacts</h5>
            
            {/* Added stakeholders list */}
            {formData.contacts && formData.contacts.length > 0 ? (
              <div className="space-y-2 mb-4">
                {formData.contacts.map((contact, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div>
                      <span className="font-semibold text-gray-800 text-sm">{contact.name}</span>
                      <span className="ml-2 px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 capitalize">
                        {contact.role ? contact.role.replace(/_/g, ' ') : ''}
                      </span>
                      <span className="ml-2 px-2 py-0.5 text-xs rounded bg-green-100 text-green-700 font-medium">
                        {contact.decision_authority}
                      </span>
                      <div className="text-xs text-gray-500 mt-1">
                        {contact.phone && `📞 ${contact.phone}`} {contact.email && ` | ✉️ ${contact.email}`} {contact.relationship_notes && ` | 📝 ${contact.relationship_notes}`}
                      </div>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => {
                        const updated = formData.contacts.filter((_, i) => i !== idx);
                        setFormData({ ...formData, contacts: updated });
                      }}
                      className="text-red-500 hover:text-red-700 py-1 h-auto text-xs"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center text-gray-500 text-sm mb-4">
                No additional stakeholders added yet.
              </div>
            )}

            {/* Add stakeholder fields */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Add Stakeholder / Contact</div>
              <div className="grid grid-cols-3 gap-4">
                <Input 
                  label="Full Name" 
                  placeholder="e.g. John Doe"
                  value={newContact.name}
                  onChange={e => setNewContact({...newContact, name: e.target.value})}
                />
                <Input 
                  label="Phone" 
                  placeholder="e.g. 9876543210"
                  value={newContact.phone}
                  onChange={e => setNewContact({...newContact, phone: e.target.value})}
                />
                <Input 
                  label="Email" 
                  type="email"
                  placeholder="e.g. john@example.com"
                  value={newContact.email}
                  onChange={e => setNewContact({...newContact, email: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-3 gap-4 items-end">
                <Select 
                  label="Role" 
                  options={[
                    { value: 'co_owner', label: 'Co-owner' },
                    { value: 'spouse', label: 'Spouse' },
                    { value: 'architect', label: 'Architect' },
                    { value: 'builder_representative', label: 'Builder Representative' },
                    { value: 'legal', label: 'Legal Representative' },
                    { value: 'other', label: 'Other' }
                  ]}
                  value={newContact.role}
                  onChange={v => setNewContact({...newContact, role: v})}
                />
                <Select 
                  label="Decision Power" 
                  options={[
                    { value: 'Primary', label: 'Primary Decision Maker' },
                    { value: 'Influencer', label: 'Influencer' },
                    { value: 'Consultant', label: 'Consultant' }
                  ]}
                  value={newContact.decision_authority}
                  onChange={v => setNewContact({...newContact, decision_authority: v})}
                />
                <Input 
                  label="Relationship Notes" 
                  placeholder="e.g. Spouse co-approves design"
                  value={newContact.relationship_notes}
                  onChange={e => setNewContact({...newContact, relationship_notes: e.target.value})}
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    if (!newContact.name || newContact.name.trim() === '') {
                      toast.error('Contact name is required');
                      return;
                    }
                    setFormData(prev => ({
                      ...prev,
                      contacts: [...(prev.contacts || []), { ...newContact, name: newContact.name.trim() }]
                    }));
                    setNewContact({
                      name: '',
                      phone: '',
                      email: '',
                      role: 'co_owner',
                      decision_authority: 'Influencer',
                      relationship_notes: ''
                    });
                  }}
                  className="h-[36px] py-1 text-xs"
                >
                  Add Stakeholder
                </Button>
              </div>
            </div>
          </div>

          {/* Project Vendors */}
          <div className="border-t border-gray-100 pt-4">
            <h5 className="font-semibold text-gray-800 text-sm mb-3">Project Vendors Engagement</h5>
            
            {/* Added vendors list */}
            {formData.vendors && formData.vendors.length > 0 ? (
              <div className="space-y-2 mb-4">
                {formData.vendors.map((vendor, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div>
                      <span className="font-semibold text-gray-800 text-sm">{vendor.vendor_name}</span>
                      <span className="ml-2 px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 capitalize">
                        Scope: {vendor.scope_of_work || 'Not specified'}
                      </span>
                      <span className="ml-2 px-2 py-0.5 text-xs rounded bg-green-100 text-green-700 font-medium">
                        ₹{vendor.agreed_rate || '0'}
                      </span>
                      <div className="text-xs text-gray-500 mt-1">
                        Status: <span className="capitalize font-semibold text-gray-700">{vendor.status}</span> {vendor.payment_terms && ` | Terms: ${vendor.payment_terms}`}
                      </div>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => {
                        const updated = formData.vendors.filter((_, i) => i !== idx);
                        setFormData({ ...formData, vendors: updated });
                      }}
                      className="text-red-500 hover:text-red-700 py-1 h-auto text-xs"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center text-gray-500 text-sm mb-4">
                No vendors assigned to this project yet.
              </div>
            )}

            {/* Add vendor fields */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Add Vendor Engagement</div>
              <div className="grid grid-cols-3 gap-4">
                <Input 
                  label="Vendor Name" 
                  placeholder="e.g. Balaji Marbles"
                  value={newVendor.vendor_name}
                  onChange={e => setNewVendor({...newVendor, vendor_name: e.target.value})}
                />
                <Input 
                  label="Scope of Work" 
                  placeholder="e.g. Marble laying and polishing"
                  value={newVendor.scope_of_work}
                  onChange={e => setNewVendor({...newVendor, scope_of_work: e.target.value})}
                />
                <Input 
                  label="Agreed Rate / Value (₹)" 
                  type="number"
                  placeholder="e.g. 75000"
                  value={newVendor.agreed_rate}
                  onChange={e => setNewVendor({...newVendor, agreed_rate: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-3 gap-4 items-end">
                <Input 
                  label="Agreed Payment Terms" 
                  placeholder="e.g. 30% advance, 40% mid-way, 30% signoff"
                  value={newVendor.payment_terms}
                  onChange={e => setNewVendor({...newVendor, payment_terms: e.target.value})}
                />
                <Select 
                  label="Engagement Status" 
                  options={[
                    { value: 'pending', label: 'Pending / Negotiating' },
                    { value: 'active', label: 'Active' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'terminated', label: 'Terminated' }
                  ]}
                  value={newVendor.status}
                  onChange={v => setNewVendor({...newVendor, status: v})}
                />
                <div className="flex justify-end pt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      if (!newVendor.vendor_name || newVendor.vendor_name.trim() === '') {
                        toast.error('Vendor name is required');
                        return;
                      }
                      setFormData(prev => ({
                        ...prev,
                        vendors: [...(prev.vendors || []), { ...newVendor, vendor_name: newVendor.vendor_name.trim() }]
                      }));
                      setNewVendor({
                        vendor_name: '',
                        scope_of_work: '',
                        agreed_rate: '',
                        payment_terms: '',
                        status: 'pending'
                      });
                    }}
                    className="h-[36px] py-1 text-xs"
                  >
                    Add Vendor
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Project Consultants */}
          <div className="border-t border-gray-100 pt-4">
            <h5 className="font-semibold text-gray-800 text-sm mb-3">External Consultants Assigned</h5>
            
            {/* Added consultants list */}
            {formData.consultants && formData.consultants.length > 0 ? (
              <div className="space-y-2 mb-4">
                {formData.consultants.map((consultant, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div>
                      <span className="font-semibold text-gray-800 text-sm">{consultant.name}</span>
                      <span className="ml-2 px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 capitalize">
                        {consultant.role ? consultant.role.replace(/_/g, ' ') : ''}
                      </span>
                      {consultant.firm && (
                        <span className="ml-2 text-xs text-gray-500">
                          Firm: {consultant.firm}
                        </span>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {consultant.phone && `📞 ${consultant.phone}`} {consultant.email && ` | ✉️ ${consultant.email}`}
                      </div>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => {
                        const updated = formData.consultants.filter((_, i) => i !== idx);
                        setFormData({ ...formData, consultants: updated });
                      }}
                      className="text-red-500 hover:text-red-700 py-1 h-auto text-xs"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center text-gray-500 text-sm mb-4">
                No external consultants assigned to this project yet.
              </div>
            )}

            {/* Add consultant fields */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Assign Consultant</div>
              <div className="grid grid-cols-3 gap-4">
                <Input 
                  label="Consultant Name" 
                  placeholder="e.g. Dr. H. C. Verma"
                  value={newConsultant.name}
                  onChange={e => setNewConsultant({...newConsultant, name: e.target.value})}
                />
                <Input 
                  label="Firm Name" 
                  placeholder="e.g. Verma Structural Consultants"
                  value={newConsultant.firm}
                  onChange={e => setNewConsultant({...newConsultant, firm: e.target.value})}
                />
                <Select 
                  label="Consultant Role" 
                  options={[
                    { value: 'structural_engineer', label: 'Structural Engineer' },
                    { value: 'mep_consultant', label: 'MEP Consultant' },
                    { value: 'lighting_designer', label: 'Lighting Designer' },
                    { value: 'landscape_consultant', label: 'Landscape Consultant' },
                    { value: 'other', label: 'Other Special Consultant' }
                  ]}
                  value={newConsultant.role}
                  onChange={v => setNewConsultant({...newConsultant, role: v})}
                />
              </div>
              <div className="grid grid-cols-3 gap-4 items-end">
                <Input 
                  label="Phone Number" 
                  placeholder="e.g. 9876543210"
                  value={newConsultant.phone}
                  onChange={e => setNewConsultant({...newConsultant, phone: e.target.value})}
                />
                <Input 
                  label="Email Address" 
                  type="email"
                  placeholder="e.g. consultant@firm.com"
                  value={newConsultant.email}
                  onChange={e => setNewConsultant({...newConsultant, email: e.target.value})}
                />
                <div className="flex justify-end pt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      if (!newConsultant.name || newConsultant.name.trim() === '') {
                        toast.error('Consultant name is required');
                        return;
                      }
                      setFormData(prev => ({
                        ...prev,
                        consultants: [...(prev.consultants || []), { ...newConsultant, name: newConsultant.name.trim() }]
                      }));
                      setNewConsultant({
                        name: '',
                        role: 'structural_engineer',
                        firm: '',
                        email: '',
                        phone: ''
                      });
                    }}
                    className="h-[36px] py-1 text-xs"
                  >
                    Add Consultant
                  </Button>
                </div>
              </div>
            </div>
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
