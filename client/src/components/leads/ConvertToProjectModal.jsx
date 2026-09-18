/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { Modal, Button, Input, Select } from '../ui';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';
import { useS3Upload } from '../../hooks/useS3Upload';
import { useTaskNotifications } from '../../store/TaskNotificationContext';
import { fetchProjectTypes, DEFAULT_PROJECT_TYPES } from '../../constants/projectTypes';

export default function ConvertToProjectModal({ lead, isOpen, onClose, onConverted }) {
  const toast = useToast();
  const { uploadContract, uploading, progress } = useS3Upload();
  const { addNotification } = useTaskNotifications();
  const [loading, setLoading] = useState(false);
  const [projectTypes, setProjectTypes] = useState(DEFAULT_PROJECT_TYPES);

  useEffect(() => {
    if (isOpen) {
      fetchProjectTypes().then(types => setProjectTypes(types));
    }
  }, [isOpen]);
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

  const [notifyRules, setNotifyRules] = useState({
    notify_pm: true,
    notify_crm: true,
    notify_finance: true
  });

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
  const [paymentTemplates, setPaymentTemplates] = useState([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [teamUsers, setTeamUsers] = useState([]);

  useEffect(() => {
    if (isOpen) {
      api.get('/users?limit=100')
        .then(res => {
          const list = res.data?.data?.users || res.data?.data || res.data?.users || (Array.isArray(res.data) ? res.data : []);
          if (Array.isArray(list)) {
            setTeamUsers(list);
          }
        })
        .catch(err => console.warn('Could not fetch team users for modal:', err));
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && lead) {
      const rawScope = lead.project_type || lead.scope || lead.scope_of_work || lead.property_type || lead.requirement_type || '';
      const sLower = String(rawScope).toLowerCase();
      let initialProjectType = '';
      if (sLower.includes('full') || sLower.includes('home') || sLower.includes('interior')) initialProjectType = 'full_interior';
      else if (sLower.includes('kitchen') || sLower.includes('modular')) initialProjectType = 'modular_kitchen';
      else if (sLower.includes('commercial') || sLower.includes('office')) initialProjectType = 'commercial';
      else if (sLower.includes('turnkey')) initialProjectType = 'turnkey';
      else initialProjectType = 'full_interior';

      const initialValue = lead.contract_value || lead.budget_max || lead.budget || lead.value || lead.estimated_budget || lead.estimated_value || '';
      const initialAdvance = lead.advance_amount || lead.booking_amount || lead.advanceAmount || '';
      const initialPm = lead.pm_id || lead.project_manager_id || lead.assignee_id || lead.sales_rep_id || '';
      const initialDesigner = lead.designer_id || lead.lead_designer_id || lead.designer || '';
      const initialTerms = lead.payment_terms || '10_40_40_10';
      const initialStart = lead.expected_start_date || lead.start_date || new Date().toISOString().slice(0, 10);
      const initialHandover = lead.target_handover_date || lead.handover_date || lead.target_date || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      setFormData({
        projectType: initialProjectType,
        clientName: lead.name || '',
        clientPhone: lead.phone || '',
        clientEmail: lead.email || '',
        projectName: lead.name ? `${lead.name}'s Project` : '',
        pm: initialPm,
        designer: initialDesigner,
        contractValue: initialValue,
        advanceAmount: initialAdvance,
        startDate: initialStart,
        handoverDate: initialHandover,
        paymentTerms: initialTerms,
        agreement_signed_by: lead.name || '',
        agreement_signed_at: new Date().toISOString().slice(0, 10),
        agreement_signature_method: 'digital',
        flat_number: lead.flat_number || lead.unit_number || '',
        floor: lead.floor || '',
        building_name: lead.building_name || lead.society_name || '',
        street: lead.street || lead.locality || lead.address || '',
        city: lead.city || 'Bengaluru',
        pincode: lead.pincode || lead.zip_code || '',
        landmark: lead.landmark || '',
        latitude: lead.latitude || '',
        longitude: lead.longitude || '',
        builder_name: lead.builder_name || '',
        society_name: lead.society_name || '',
        rera_id: lead.rera_id || '',
        noc_status: lead.noc_status || 'pending',
        occupancy_certificate_status: lead.occupancy_certificate_status || 'pending',
        property_handover_date: lead.property_handover_date || '',
        contacts: lead.contacts || [],
        carpet_area: lead.carpet_area || '',
        built_up_area: lead.built_up_area || '',
        number_of_rooms: lead.number_of_rooms || '',
        project_category: lead.project_category || '',
        project_sub_category: lead.project_sub_category || '',
        property_type: lead.property_type || '',
        property_age: lead.property_age || '',
        renovation_scope: lead.renovation_scope || '',
        segment: lead.segment || '',
        measurements: lead.measurements || [],
        vendors: lead.vendors || [],
        consultants: lead.consultants || []
      });
      setContractFile(null);

      const loadExistingProject = async () => {
        try {
          let projId = lead.converted_to_project_id;
          let project = null;

          if (projId) {
            const res = await api.get(`/projects/${projId}`);
            project = res.data?.data || res.data;
          } else {
            const res = await api.get('/projects', { params: { lead_id: lead.id } });
            const projectsList = res.data?.data?.projects || res.data?.data || res.data?.projects || (Array.isArray(res.data) ? res.data : []);
            if (Array.isArray(projectsList)) {
              project = projectsList.find(p => String(p.lead_id) === String(lead.id));
            }
          }

          if (project) {
            if (!lead.converted_to_project_id) {
              lead.converted_to_project_id = project.id;
            }
            setFormData(prev => ({
              ...prev,
              projectName: project.name || prev.projectName,
              projectType: project.project_type || prev.projectType,
              clientName: project.client_name || prev.clientName,
              clientPhone: project.client_phone || prev.clientPhone,
              clientEmail: project.client_email || prev.clientEmail,
              pm: project.pm_id || prev.pm,
              designer: project.designer_id || prev.designer,
              contractValue: project.contract_value ?? project.value ?? prev.contractValue,
              advanceAmount: project.booking_amount ?? project.advance_amount ?? prev.advanceAmount,
              startDate: project.start_date ? String(project.start_date).slice(0, 10) : prev.startDate,
              handoverDate: project.target_date ? String(project.target_date).slice(0, 10) : prev.handoverDate,
              paymentTerms: project.payment_terms || prev.paymentTerms,
              flat_number: project.flat_number || prev.flat_number,
              floor: project.floor || prev.floor,
              building_name: project.building_name || prev.building_name,
              street: project.street || prev.street,
              city: project.city || prev.city,
              pincode: project.pincode || prev.pincode,
              landmark: project.landmark || prev.landmark,
              builder_name: project.builder_name || prev.builder_name,
              society_name: project.society_name || prev.society_name,
              rera_id: project.rera_id || prev.rera_id,
              carpet_area: project.carpet_area || prev.carpet_area,
              built_up_area: project.built_up_area || prev.built_up_area,
              number_of_rooms: project.number_of_rooms || prev.number_of_rooms
            }));

            setChecklist(prev => {
              const updated = { ...prev };
              Object.keys(updated).forEach(k => { updated[k] = true; });
              return updated;
            });
          }
        } catch (err) {
          console.warn('Could not load existing project for converted lead:', err);
        }
      };

      if (lead.status === 'converted' || lead.converted_to_project_id) {
        loadExistingProject();
      }



      const loadChecklistConfig = async () => {
        try {
          setLoadingConfig(true);
          const res = await api.get('/config/tenant-settings');
          const defaultChecklist = [
            { key: 'site_address_confirmed', label: 'Site address confirmed', required: false, active: true },
            { key: 'site_visit_completed', label: 'Site visit completed', required: true, active: true },
            { key: 'floor_plan', label: 'Floor plan attached', required: false, active: true },
            { key: 'scope_finalized', label: 'Scope frozen', required: true, active: true },
            { key: 'booking_received', label: 'Booking amount received', required: true, active: true },
            { key: 'contract_signed', label: 'Contract signed', required: true, active: true }
          ];
          const config = res.data?.data?.pre_conversion_checklist || defaultChecklist;
          const activeItems = config.filter(item => item.active);
          setChecklistConfig(activeItems);

          const defaultTpls = [
            { id: 'tpl-5month-20', name: '5-Month Equal Installment Plan (20% x 5)', milestones: [{ name: 'M1', percentage: 20 }, { name: 'M2', percentage: 20 }, { name: 'M3', percentage: 20 }, { name: 'M4', percentage: 20 }, { name: 'M5', percentage: 20 }] },
            { id: 'tpl-3stage-20-50-30', name: 'Standard 3-Stage Milestone (20% - 50% - 30%)', milestones: [{ name: 'M1', percentage: 20 }, { name: 'M2', percentage: 50 }, { name: 'M3', percentage: 30 }] },
            { id: 'tpl-4stage-10-40-40-10', name: 'Commercial Construction 4-Stage (10% - 40% - 40% - 10%)', milestones: [{ name: 'M1', percentage: 10 }, { name: 'M2', percentage: 40 }, { name: 'M3', percentage: 40 }, { name: 'M4', percentage: 10 }] }
          ];
          const serverTpls = res.data?.data?.payment_templates;
          let mergedTpls = defaultTpls;
          if (Array.isArray(serverTpls) && serverTpls.length > 0) {
            const map = new Map();
            defaultTpls.forEach(t => map.set(t.id, t));
            serverTpls.forEach(t => map.set(t.id, t));
            mergedTpls = Array.from(map.values());
          }
          setPaymentTemplates(mergedTpls);

          const initialChecklist = {};
          activeItems.forEach(item => {
            initialChecklist[item.key] = false;
          });
          setChecklist(initialChecklist);
        } catch (err) {
          console.error('Failed to load settings config', err);
          const fallback = [
            { key: 'site_address_confirmed', label: 'Site address confirmed', required: false, active: true },
            { key: 'site_visit_completed', label: 'Site visit completed', required: true, active: true },
            { key: 'floor_plan', label: 'Floor plan attached', required: false, active: true },
            { key: 'scope_finalized', label: 'Scope frozen', required: true, active: true },
            { key: 'booking_received', label: 'Booking amount received', required: true, active: true },
            { key: 'contract_signed', label: 'Contract signed', required: true, active: true }
          ];
          setChecklistConfig(fallback);
          setPaymentTemplates([
            { id: 'tpl-5month-20', name: '5-Month Equal Installment Plan (20% x 5)', milestones: [{ percentage: 20 }] },
            { id: 'tpl-3stage-20-50-30', name: 'Standard 3-Stage Milestone (20% - 50% - 30%)', milestones: [{ percentage: 20 }] },
            { id: 'tpl-4stage-10-40-40-10', name: 'Commercial Construction 4-Stage (10% - 40% - 40% - 10%)', milestones: [{ percentage: 10 }] }
          ]);
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
    const firstUserId = teamUsers[0]?.id || '';
    const secondUserId = teamUsers[1]?.id || firstUserId;

    setFormData({
      projectType: formData.projectType || 'full_interior',
      clientName: formData.clientName || lead?.name || '',
      clientPhone: formData.clientPhone || lead?.phone || '',
      clientEmail: formData.clientEmail || lead?.email || '',
      projectName: formData.projectName || (lead?.name ? `${lead.name}'s Project` : 'New Project'),
      pm: formData.pm || firstUserId,
      designer: formData.designer || secondUserId,
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

  const handlePaymentTermsChange = (terms) => {
    let advance = '';
    const contractVal = parseFloat(formData.contractValue) || 0;
    if (terms && contractVal > 0) {
      const selectedTpl = paymentTemplates.find(t => t.id === terms);
      let firstPercentage = 0;
      if (selectedTpl && selectedTpl.milestones && selectedTpl.milestones.length > 0) {
        firstPercentage = Number(selectedTpl.milestones[0].percentage) || 0;
      } else {
        const parts = terms.split('_').map(Number);
        if (parts.length > 0 && !isNaN(parts[0])) {
          firstPercentage = parts[0];
        }
      }
      if (firstPercentage > 0) {
        advance = Math.round(contractVal * (firstPercentage / 100));
      }
    }
    setFormData(prev => ({
      ...prev,
      paymentTerms: terms,
      advanceAmount: advance
    }));
  };

  const handleContractValueChange = (val) => {
    let advance = formData.advanceAmount;
    const contractVal = parseFloat(val) || 0;
    if (formData.paymentTerms && contractVal > 0) {
      const selectedTpl = paymentTemplates.find(t => t.id === formData.paymentTerms);
      let firstPercentage = 0;
      if (selectedTpl && selectedTpl.milestones && selectedTpl.milestones.length > 0) {
        firstPercentage = Number(selectedTpl.milestones[0].percentage) || 0;
      } else {
        const parts = formData.paymentTerms.split('_').map(Number);
        if (parts.length > 0 && !isNaN(parts[0])) {
          firstPercentage = parts[0];
        }
      }
      if (firstPercentage > 0) {
        advance = Math.round(contractVal * (firstPercentage / 100));
      }
    }
    setFormData(prev => ({
      ...prev,
      contractValue: val,
      advanceAmount: advance
    }));
  };

  const handleSubmit = async () => {
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
        notifyRules,
        contract_file_key: uploadedFile.storageKey,
        contract_file_name: uploadedFile.fileName,
        contract_file_size: uploadedFile.fileSize,
        contract_file_mime: uploadedFile.mimeType
      };
      
      // Send the actual conversion request
      const res = await api.post(`/leads/${lead.id}/convert-to-project`, payload);
      
      if (res.data.success) {
        toast.success('Project successfully created!');
        
        const projId = res.data.data.project_id;
        const projName = formData.projectName || 'New Project';
        
        if (notifyRules.notify_pm) {
          addNotification('mentioned', 'Sales Handover Alert', `You have been assigned as the Project Manager for "${projName}". Please review the BOQ and schedule the design kickoff.`, projId);
        }
        if (notifyRules.notify_crm) {
          addNotification('mentioned', 'Sales Handover Alert', `A new project "${projName}" has been handed over. You are assigned as the CRM Executive for this account.`, projId);
        }
        if (notifyRules.notify_finance) {
          addNotification('status_changed', 'Sales Handover Alert', `New project "${projName}" created by Sales. Advance payment of ₹${Number(formData.advanceAmount || 0).toLocaleString()} is pending auditing.`, projId);
        }

        onClose();
        if (onConverted) onConverted(projId);
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
          <Button 
            variant="primary" 
            onClick={handleSubmit} 
            disabled={loading || lead.status === 'converted' || Boolean(lead.converted_to_project_id)}
          >
            {loading ? 'Creating...' : (lead.status === 'converted' || lead.converted_to_project_id ? 'Already Converted' : 'Create Project')}
          </Button>
        </>
      }
    >
      <div className="space-y-6 pb-2">
        {(lead.status === 'converted' || lead.converted_to_project_id) && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-sm flex items-center justify-between">
            <div>
              <strong>Lead Already Converted!</strong> This lead has already been converted into a project.
            </div>
            {lead.converted_to_project_id && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  onClose();
                  window.location.href = `/projects/${lead.converted_to_project_id}`;
                }}
              >
                View Project
              </Button>
            )}
          </div>
        )}

        {/* Lead Summary Section */}
        <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4 border-b border-[var(--color-border)] pb-3">
            <h4 className="font-bold text-[var(--color-text)] text-base flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Lead Summary
            </h4>
            <Button variant="outline" size="sm" onClick={fillMockData} className="py-1 h-auto text-xs font-semibold">Fill Mock Data</Button>
          </div>
          <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
            <div>
              <span className="text-[var(--color-text-secondary)] block text-xs font-medium uppercase tracking-wider mb-1">Client</span>
              <span className="font-semibold text-[var(--color-text)]">{lead.name || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)] block text-xs font-medium uppercase tracking-wider mb-1">Contact</span>
              <span className="font-semibold text-[var(--color-text)]">{lead.phone || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)] block text-xs font-medium uppercase tracking-wider mb-1">Scope</span>
              <span className="font-semibold text-[var(--color-text)] capitalize">
                {lead.scope || lead.project_type || lead.scope_of_work
                  ? String(lead.scope || lead.project_type || lead.scope_of_work).replace('_', ' ')
                  : (formData.projectType ? String(formData.projectType).replace('_', ' ') : 'Full Interior')}
              </span>
            </div>
            <div>
              <span className="text-[var(--color-text-secondary)] block text-xs font-medium uppercase tracking-wider mb-1">Max Budget</span>
              <span className="font-semibold text-[var(--color-text)]">
                {lead.budget_max || lead.budget || lead.value || lead.estimated_budget || formData.contractValue
                  ? `₹${Number(lead.budget_max || lead.budget || lead.value || lead.estimated_budget || formData.contractValue).toLocaleString('en-IN')}`
                  : 'N/A'}
              </span>
            </div>
            {lead.locality && (
              <div className="col-span-2">
                <span className="text-[var(--color-text-secondary)] block text-xs font-medium uppercase tracking-wider mb-1">Locality</span>
                <span className="font-semibold text-[var(--color-text)]">{lead.locality}</span>
              </div>
            )}
          </div>
        </div>

        {/* Checklist Section */}
        <div className="bg-[var(--color-info-bg)] border border-[var(--color-info)] border-opacity-20 p-5 rounded-xl shadow-sm">
          <h4 className="font-bold text-[var(--color-info)] mb-3 text-xs tracking-wider uppercase flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--color-info)] animate-pulse" />
            Pre-Conversion Checklist
          </h4>
          {loadingConfig ? (
            <div className="text-sm text-[var(--color-text-secondary)]">Loading checklist...</div>
          ) : (
            <div className="space-y-2.5">
              {checklistConfig.map(item => (
                <label key={item.key} className="flex items-center gap-2.5 text-sm text-[var(--color-text)] cursor-pointer hover:text-[var(--color-primary)] transition-colors">
                  <input 
                    type="checkbox" 
                    checked={!!checklist[item.key]} 
                    onChange={e => setChecklist(p => ({...p, [item.key]: e.target.checked}))}
                    className="w-4 h-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] border-[var(--color-border)]"
                  />
                  <span>
                    {item.label}
                    {item.required && <span className="text-[var(--color-danger)] ml-1 font-bold" title="Mandatory requirement">*</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Form Section */}
        <div className="space-y-5">
          <Input 
            label="Project Name *" 
            value={formData.projectName} 
            onChange={e => setFormData({...formData, projectName: e.target.value})} 
          />
          <div className="grid grid-cols-2 gap-4">
            <Select 
              label="Project Type *" 
              options={(() => {
                const opts = [{ value: '', label: 'Select Type' }, ...projectTypes.map(t => ({ value: t.id, label: t.label }))];
                if (formData.projectType && !opts.some(o => o.value === formData.projectType)) {
                  opts.push({ value: formData.projectType, label: String(formData.projectType).replace(/_/g, ' ') });
                }
                return opts;
              })()}
              value={formData.projectType}
              onChange={v => setFormData({...formData, projectType: v})}
            />
            <Select 
              label="Project Manager *" 
              options={(() => {
                const opts = [{ value: '', label: 'Select PM' }];
                teamUsers.forEach(u => {
                  const uName = u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
                  if (uName && !opts.some(o => o.value === u.id)) {
                    opts.push({ value: u.id, label: uName });
                  }
                });

                if (formData.pm && !opts.some(o => o.value === formData.pm)) {
                  const match = teamUsers.find(u => String(u.id) === String(formData.pm));
                  const label = match 
                    ? (match.name || `${match.first_name || ''} ${match.last_name || ''}`.trim())
                    : (formData.pm_name || `Project Manager (${formData.pm.slice(0, 8)}...)`);
                  opts.push({ value: formData.pm, label });
                }
                return opts;
              })()}
              value={formData.pm}
              onChange={v => setFormData({...formData, pm: v})}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select 
              label="Lead Designer" 
              options={(() => {
                const opts = [{ value: '', label: 'Select Designer' }];
                teamUsers.forEach(u => {
                  const uName = u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
                  if (uName && !opts.some(o => o.value === u.id)) {
                    opts.push({ value: u.id, label: uName });
                  }
                });

                if (formData.designer && !opts.some(o => o.value === formData.designer)) {
                  const match = teamUsers.find(u => String(u.id) === String(formData.designer));
                  const label = match 
                    ? (match.name || `${match.first_name || ''} ${match.last_name || ''}`.trim())
                    : (formData.designer_name || `Lead Designer (${formData.designer.slice(0, 8)}...)`);
                  opts.push({ value: formData.designer, label });
                }
                return opts;
              })()}
              value={formData.designer}
              onChange={v => setFormData({...formData, designer: v})}
            />
            <Select 
              label="Payment Terms" 
              options={(() => {
                const opts = [
                  { value: '', label: 'Select Terms' },
                  ...paymentTemplates.map(t => {
                    const percLabel = Array.isArray(t.milestones) && t.milestones.length > 0
                      ? t.milestones.map(m => (m.percentage !== undefined ? m.percentage : 0) + '%').join(', ')
                      : t.name;
                    return { value: t.id, label: percLabel };
                  }),
                  { value: '10_40_40_10', label: '10%, 40%, 40%, 10%' },
                  { value: '30_30_30_10', label: '30%, 30%, 30%, 10%' },
                  { value: '50_50', label: '50%, 50%' }
                ];
                if (formData.paymentTerms && !opts.some(o => o.value === formData.paymentTerms)) {
                  opts.push({ value: formData.paymentTerms, label: String(formData.paymentTerms).replace(/_/g, '%, ') + '%' });
                }
                return opts;
              })()}
              value={formData.paymentTerms}
              onChange={handlePaymentTermsChange}
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
              onChange={e => handleContractValueChange(e.target.value)} 
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
          <div className="border-t border-[var(--color-border)] pt-5 mt-6">
            <h5 className="font-bold text-[var(--color-text)] text-xs mb-4 tracking-wider uppercase text-opacity-80">Site Address Details</h5>
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
          </div>

           {/* Handover Notification Rules */}
          <div className="border-t border-[var(--color-border)] pt-5 mt-6 space-y-3.5">
            <h5 className="font-bold text-[var(--color-text)] text-xs mb-1 tracking-wider uppercase text-opacity-80">Handover Notification Rules</h5>
            <p className="text-xs text-[var(--color-text-secondary)] font-medium">Select which roles should receive automated tasks & system notifications upon successful conversion:</p>
            <div className="flex gap-8">
              <label className="flex items-center gap-2.5 text-sm text-[var(--color-text)] cursor-pointer hover:text-[var(--color-primary)] transition-colors">
                <input 
                  type="checkbox" 
                  checked={notifyRules.notify_pm} 
                  onChange={e => setNotifyRules(p => ({...p, notify_pm: e.target.checked}))}
                  className="w-4 h-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] border-[var(--color-border)]"
                />
                <span>Project Manager</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm text-[var(--color-text)] cursor-pointer hover:text-[var(--color-primary)] transition-colors">
                <input 
                  type="checkbox" 
                  checked={notifyRules.notify_crm} 
                  onChange={e => setNotifyRules(p => ({...p, notify_crm: e.target.checked}))}
                  className="w-4 h-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] border-[var(--color-border)]"
                />
                <span>CRM Executive</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm text-[var(--color-text)] cursor-pointer hover:text-[var(--color-primary)] transition-colors">
                <input 
                  type="checkbox" 
                  checked={notifyRules.notify_finance} 
                  onChange={e => setNotifyRules(p => ({...p, notify_finance: e.target.checked}))}
                  className="w-4 h-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] border-[var(--color-border)]"
                />
                <span>Finance Auditor</span>
              </label>
            </div>
          </div>

          {/* Contract File Section */}
          <div className="space-y-3 mt-6 border-t border-[var(--color-border)] pt-5">
            <label className="block text-sm font-bold text-[var(--color-text)]">Signed Contract Document *</label>
            <div className="flex items-center gap-4">
              <input 
                id="contract_file_input"
                type="file" 
                accept=".pdf,.png,.jpg,.jpeg" 
                onChange={e => setContractFile(e.target.files[0] || null)}
                className="block w-full text-sm text-[var(--color-text-secondary)] file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[var(--color-primary-bg)] file:text-[var(--color-primary)] hover:file:bg-opacity-80 cursor-pointer transition-colors"
              />
              {uploading && (
                <span className="text-xs text-[var(--color-primary)] font-semibold whitespace-nowrap animate-pulse">Uploading ({progress}%)...</span>
              )}
            </div>
            {contractFile && (
              <div className="flex items-center gap-3 mt-1.5">
                <p className="text-xs text-[var(--color-text-secondary)] font-medium">Selected file: <span className="font-semibold text-[var(--color-text)]">{contractFile.name}</span> ({(contractFile.size / 1024).toFixed(1)} KB)</p>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-0.5 rounded bg-red-50 hover:bg-red-100 transition-colors"
                >
                  Delete
                </button>
              </div>
            )}
            {showDeleteConfirm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
                  <h3 className="text-lg font-bold text-[var(--color-text)] mb-2">Delete File</h3>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-6">Are you sure you want to remove the selected contract document?</p>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setContractFile(null);
                        const fileInput = document.getElementById('contract_file_input');
                        if (fileInput) fileInput.value = '';
                        setShowDeleteConfirm(false);
                      }}
                      className="px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg shadow-sm transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
