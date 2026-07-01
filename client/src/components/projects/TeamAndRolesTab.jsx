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
    setFormData({
      pm: project.pm_id || '',
      designer: project.designer_id || '',
      leadDesigner: project.lead_designer_id || '',
      juniorDesigner: project.junior_designer_id || '',
      siteEngineer: project.site_engineer_id || '',
      qcEngineer: project.qc_engineer_id || '',
      siteSupervisor: project.site_supervisor_id || '',
      crmExecutive: project.crm_executive_id || '',
      procurementOfficer: project.procurement_officer_id || '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        pm_id: formData.pm || null,
        designer_id: formData.designer || null,
        lead_designer_id: formData.leadDesigner || null,
        junior_designer_id: formData.juniorDesigner || null,
        site_engineer_id: formData.siteEngineer || null,
        qc_engineer_id: formData.qcEngineer || null,
        site_supervisor_id: formData.siteSupervisor || null,
        crm_executive_id: formData.crmExecutive || null,
        procurement_officer_id: formData.procurementOfficer || null,
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

  const fields = [
    { label: 'Project Manager', value: project.pm_name || '—' },
    { label: 'Designer', value: project.designer_name || '—' },
    { label: 'Lead Designer', value: project.lead_designer_name || '—' },
    { label: 'Junior Designer', value: project.junior_designer_name || '—' },
    { label: 'Site Engineer', value: project.site_engineer_name || '—' },
    { label: 'QC Engineer', value: project.qc_engineer_name || '—' },
    { label: 'Site Supervisor', value: project.site_supervisor_name || '—' },
    { label: 'CRM Executive', value: project.crm_executive_name || '—' },
    { label: 'Procurement Officer', value: project.procurement_officer_name || '—' },
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 0 }}>
          {fields.map((f, i) => (
            <div key={f.label} style={{
              padding: '14px 20px',
              borderBottom: i < fields.length - (fields.length % 2 === 0 ? 2 : 1) ? '1px solid var(--color-border)' : 'none',
              borderRight: (i % 2 === 0) ? '1px solid var(--color-border)' : 'none',
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
            options={getOptions(['project manager', 'pm'])}
            value={formData.pm}
            onChange={v => setFormData({...formData, pm: v})}
          />
          <Select 
            label="Designer" 
            options={getOptions(['designer'])}
            value={formData.designer}
            onChange={v => setFormData({...formData, designer: v})}
          />
          <Select 
            label="Lead Designer" 
            options={getOptions(['designer', 'lead'])}
            value={formData.leadDesigner}
            onChange={v => setFormData({...formData, leadDesigner: v})}
          />
          <Select 
            label="Junior Designer" 
            options={getOptions(['designer', 'junior'])}
            value={formData.juniorDesigner}
            onChange={v => setFormData({...formData, juniorDesigner: v})}
          />
          <Select 
            label="Site Engineer" 
            options={getOptions(['engineer', 'site'])}
            value={formData.siteEngineer}
            onChange={v => setFormData({...formData, siteEngineer: v})}
          />
          <Select 
            label="QC Engineer" 
            options={getOptions(['qc', 'quality'])}
            value={formData.qcEngineer}
            onChange={v => setFormData({...formData, qcEngineer: v})}
          />
          <Select 
            label="Site Supervisor" 
            options={getOptions(['supervisor'])}
            value={formData.siteSupervisor}
            onChange={v => setFormData({...formData, siteSupervisor: v})}
          />
          <Select 
            label="CRM Executive" 
            options={getOptions(['crm', 'executive'])}
            value={formData.crmExecutive}
            onChange={v => setFormData({...formData, crmExecutive: v})}
          />
          <Select 
            label="Procurement Officer" 
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
