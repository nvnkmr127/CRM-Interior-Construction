import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { updateLead } from '../../api/leads';
import { useToast } from '../../store/toastContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

export default function ConvertToProjectModal({ lead, isOpen, onClose, onConverted }) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    name: '', // Project Name
    type: 'Full Interior', // Project Type
    managerId: '',
    designerId: '',
    contractValue: '',
    startDate: '',
    templateId: ''
  });

  const [users, setUsers] = useState([]);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    if (isOpen && lead) {
      setFormData(prev => ({
        ...prev,
        clientName: lead.name || '',
        clientPhone: lead.phone || '',
        clientEmail: lead.email || '',
        name: lead.name ? `${lead.name} - Full Interior` : ''
      }));
      setStep(1);
      setError('');
    }
  }, [isOpen, lead]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchDeps = async () => {
      try {
        const [usersRes, templatesRes] = await Promise.all([
          api.get('/users').catch(() => ({ data: { data: [] } })),
          api.get('/config/project-templates').catch(() => ({ data: { data: [] } }))
        ]);
        
        if (usersRes.data?.success) setUsers(usersRes.data.data);
        if (templatesRes.data?.success) setTemplates(templatesRes.data.data);
      } catch (err) {
        console.error('Failed to load dependencies', err);
      }
    };

    fetchDeps();
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (!formData.clientName.trim() || !formData.name.trim()) {
      setError('Client Name and Project Name are required.');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const projectPayload = {
        name: formData.name,
        type: formData.type,
        managerId: formData.managerId || null,
        designerId: formData.designerId || null,
        contractValue: formData.contractValue ? Number(formData.contractValue) : null,
        startDate: formData.startDate || null,
        templateId: formData.templateId || null,
        clientName: formData.clientName,
        clientPhone: formData.clientPhone,
        clientEmail: formData.clientEmail,
        lead_id: lead.id
      };

      // 1. POST /api/projects
      const projectRes = await api.post('/projects', projectPayload);
      const newProject = projectRes.data?.data || projectRes.data;
      const newProjectId = newProject.id;

      // 2. PATCH /api/leads/:id
      await updateLead(lead.id, { status: 'converted' });

      // 3. toast.success
      toast.success('Project created!');

      // 4. Call onConverted
      if (onConverted) {
        onConverted(newProject);
      }

      // 5. Navigate
      navigate(`/projects/${newProjectId}`);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || 'Failed to convert lead to project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderForm = () => (
    <form id="convert-form" onSubmit={handleNext} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Client Name <span className="text-red-500">*</span></label>
          <input
            type="text"
            name="clientName"
            value={formData.clientName}
            onChange={handleChange}
            className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Client Phone</label>
          <input
            type="text"
            name="clientPhone"
            value={formData.clientPhone}
            onChange={handleChange}
            className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Client Email</label>
          <input
            type="email"
            name="clientEmail"
            value={formData.clientEmail}
            onChange={handleChange}
            className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="md:col-span-2 mt-2 pt-4 border-t border-gray-100">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Project Name <span className="text-red-500">*</span></label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. Sharma Residence - Full Interior"
            className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Project Type</label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="Full Interior">Full Interior</option>
            <option value="Modular Kitchen">Modular Kitchen</option>
            <option value="Commercial">Commercial</option>
            <option value="Turnkey">Turnkey</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Template</label>
          <select
            name="templateId"
            value={formData.templateId}
            onChange={handleChange}
            className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">No Template</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Project Manager</label>
          <select
            name="managerId"
            value={formData.managerId}
            onChange={handleChange}
            className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">Unassigned</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Designer</label>
          <select
            name="designerId"
            value={formData.designerId}
            onChange={handleChange}
            className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">Unassigned</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Contract Value (₹)</label>
          <input
            type="number"
            name="contractValue"
            value={formData.contractValue}
            onChange={handleChange}
            placeholder="0"
            className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date</label>
          <input
            type="date"
            name="startDate"
            value={formData.startDate}
            onChange={handleChange}
            className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
    </form>
  );

  const renderConfirmation = () => (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
          {error}
        </div>
      )}
      <div className="bg-blue-50 p-4 rounded-md">
        <h3 className="font-semibold text-blue-900 mb-2">Confirm Conversion</h3>
        <p className="text-sm text-blue-800 mb-4">
          You are about to convert <strong>{lead?.name}</strong> into a project. The lead status will be permanently marked as converted.
        </p>
        <div className="text-sm space-y-1 text-blue-900 bg-white/50 p-3 rounded">
          <div><span className="font-semibold">Project Name:</span> {formData.name}</div>
          <div><span className="font-semibold">Project Type:</span> {formData.type}</div>
          {formData.contractValue && <div><span className="font-semibold">Contract Value:</span> ₹{formData.contractValue}</div>}
        </div>
      </div>
    </div>
  );

  const renderFooter = () => {
    if (step === 1) {
      return (
        <div className="flex justify-end gap-2 w-full">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="convert-form">Next</Button>
        </div>
      );
    }

    return (
      <div className="flex justify-end gap-2 w-full">
        <Button variant="secondary" onClick={() => setStep(1)} disabled={isSubmitting}>Back</Button>
        <Button 
          variant="primary" 
          onClick={handleSubmit} 
          disabled={isSubmitting}
          loading={isSubmitting}
        >
          {isSubmitting ? 'Converting...' : 'Confirm & Convert'}
        </Button>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Convert to Project"
      size="md"
      footer={renderFooter()}
    >
      {step === 1 ? renderForm() : renderConfirmation()}
    </Modal>
  );
}
