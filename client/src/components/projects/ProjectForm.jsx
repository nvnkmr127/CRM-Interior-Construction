import React, { useState } from 'react';

const ProjectForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    client_name: '',
    project_type: '',
    contract_value: ''
  });

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      contract_value: formData.contract_value ? Number(formData.contract_value) : undefined
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Project Name *</label>
        <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Client Name *</label>
        <input required type="text" name="client_name" value={formData.client_name} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Project Type</label>
        <input type="text" name="project_type" value={formData.project_type} onChange={handleChange} placeholder="e.g. Residential, Commercial" className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Contract Value (₹)</label>
        <input type="number" name="contract_value" value={formData.contract_value} onChange={handleChange} className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-blue-500" />
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-700 mt-6">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">Cancel</button>
        <button type="submit" className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20">Create Project</button>
      </div>
    </form>
  );
};

export default ProjectForm;
