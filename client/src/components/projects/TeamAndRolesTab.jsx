/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { Button, Input, Select, Modal } from '../ui';
import { updateProject } from '../../api/projects';
import { usersApi } from '../../api/users';
import { useToast } from '../../store/toastContext';

export default function TeamAndRolesTab({ project, onRefresh }) {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  
  const [formData, setFormData] = useState({});

  useEffect(() => {
    usersApi.getAll().then(res => setTeamMembers(res || [])).catch(console.error);
  }, []);

  const openEdit = () => {
    usersApi.getAll().then(res => setTeamMembers(res || [])).catch(console.error);
    setFormData({
      pm: project.pm_id || '',
      designer: project.designer_ids || [],
      leadDesigner: project.lead_designer_ids || [],
      juniorDesigner: project.junior_designer_ids || [],
      siteEngineer: project.site_engineer_ids || [],
      qcEngineer: project.qc_engineer_ids || [],
      siteSupervisor: project.site_supervisor_ids || [],
      crmExecutive: project.crm_executive_ids || [],
      procurementOfficer: project.procurement_officer_ids || [],
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        pm_id: formData.pm || null,
        designer_ids: formData.designer?.length ? formData.designer : null,
        lead_designer_ids: formData.leadDesigner?.length ? formData.leadDesigner : null,
        junior_designer_ids: formData.juniorDesigner?.length ? formData.juniorDesigner : null,
        site_engineer_ids: formData.siteEngineer?.length ? formData.siteEngineer : null,
        qc_engineer_ids: formData.qcEngineer?.length ? formData.qcEngineer : null,
        site_supervisor_ids: formData.siteSupervisor?.length ? formData.siteSupervisor : null,
        crm_executive_ids: formData.crmExecutive?.length ? formData.crmExecutive : null,
        procurement_officer_ids: formData.procurementOfficer?.length ? formData.procurementOfficer : null,
      };
      await updateProject(project.id, payload);
      toast.success('Team & Roles updated successfully');
      setIsEditing(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error('Failed to update team');
    } finally {
      setSaving(false);
    }
  };

  const getRoleNames = (ids, defaultName) => {
    if (ids && Array.isArray(ids) && ids.length > 0) {
      const matched = ids.map(id => teamMembers.find(m => m.id === id)?.name).filter(Boolean);
      if (matched.length > 0) return matched.join(', ');
    } else if (ids && typeof ids === 'string') {
      const match = teamMembers.find(m => m.id === ids);
      if (match) return match.name;
    }
    return defaultName || '—';
  };

  const fields = [
    { label: 'Project Manager', value: getRoleNames(project.pm_id, project.pm_name) },
    { label: 'Designer', value: getRoleNames(project.designer_ids, project.designer_name) },
    { label: 'Lead Designer', value: getRoleNames(project.lead_designer_ids, project.lead_designer_name) },
    { label: 'Junior Designer', value: getRoleNames(project.junior_designer_ids, project.junior_designer_name) },
    { label: 'Site Engineer', value: getRoleNames(project.site_engineer_ids, project.site_engineer_name) },
    { label: 'QC Engineer', value: getRoleNames(project.qc_engineer_ids, project.qc_engineer_name) },
    { label: 'Site Supervisor', value: getRoleNames(project.site_supervisor_ids, project.site_supervisor_name) },
    { label: 'CRM Executive', value: getRoleNames(project.crm_executive_ids, project.crm_executive_name) },
    { label: 'Procurement Officer', value: getRoleNames(project.procurement_officer_ids, project.procurement_officer_name) },
  ];

  const getOptions = (roleKeywords) => {
    return [
      { value: '', label: 'Select' },
      ...teamMembers
        .filter(u => roleKeywords.some(k => (u.role_name || '').toLowerCase().includes(k) || (u.role || '').toLowerCase().includes(k)))
        .map(u => ({ value: u.id, label: u.name }))
    ];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
            Team & Roles
          </div>
          <Button variant="outline" size="sm" onClick={openEdit}>
            ✏️ Edit
          </Button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 0, margin: '0 -1px -1px 0' }}>
          {fields.map((f, i) => (
            <div key={f.label} style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--color-border)',
              borderRight: '1px solid var(--color-border)',
            }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {f.label}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text)' }}>
                {f.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title="Edit Team & Roles" size="md">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingBottom: '16px' }}>
          <Select 
            label="Project Manager" 
            options={getOptions(['project manager', 'pm', 'project_manager'])}
            value={formData.pm}
            onChange={v => setFormData({...formData, pm: v})}
          />
          <Select 
            label="Designer" 
            multi={true}
            options={getOptions(['designer'])}
            value={formData.designer}
            onChange={v => setFormData({...formData, designer: v})}
          />
          <Select 
            label="Lead Designer" 
            multi={true}
            options={getOptions(['lead'])}
            value={formData.leadDesigner}
            onChange={v => setFormData({...formData, leadDesigner: v})}
          />
          <Select 
            label="Junior Designer" 
            multi={true}
            options={getOptions(['junior'])}
            value={formData.juniorDesigner}
            onChange={v => setFormData({...formData, juniorDesigner: v})}
          />
          <Select 
            label="Site Engineer" 
            multi={true}
            options={getOptions(['engineer', 'site'])}
            value={formData.siteEngineer}
            onChange={v => setFormData({...formData, siteEngineer: v})}
          />
          <Select 
            label="QC Engineer" 
            multi={true}
            options={getOptions(['qc', 'quality'])}
            value={formData.qcEngineer}
            onChange={v => setFormData({...formData, qcEngineer: v})}
          />
          <Select 
            label="Site Supervisor" 
            multi={true}
            options={getOptions(['supervisor'])}
            value={formData.siteSupervisor}
            onChange={v => setFormData({...formData, siteSupervisor: v})}
          />
          <Select 
            label="CRM Executive" 
            multi={true}
            options={getOptions(['crm', 'executive'])}
            value={formData.crmExecutive}
            onChange={v => setFormData({...formData, crmExecutive: v})}
          />
          <Select 
            label="Procurement Officer" 
            multi={true}
            options={getOptions(['procurement'])}
            value={formData.procurementOfficer}
            onChange={v => setFormData({...formData, procurementOfficer: v})}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
          <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
        </div>
      </Modal>
    </div>
  );
}
