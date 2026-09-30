import React, { useState, useEffect } from 'react';
import { Button, Select, Modal } from '../ui';
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
    const getSingularVal = (val, arrayVal) => {
      if (typeof val === 'string' && val) return val;
      if (Array.isArray(arrayVal) && arrayVal.length > 0) return arrayVal[0];
      if (typeof arrayVal === 'string' && arrayVal) return arrayVal;
      return '';
    };

    setFormData({
      pm: project.pm_id || '',
      salesRep: project.sales_rep_id || '',
      designer: getSingularVal(project.designer_id, project.designer_ids),
      leadDesigner: getSingularVal(project.lead_designer_id, project.lead_designer_ids),
      juniorDesigner: getSingularVal(project.junior_designer_id, project.junior_designer_ids),
      siteEngineer: getSingularVal(project.site_engineer_id, project.site_engineer_ids),
      qcEngineer: getSingularVal(project.qc_engineer_id, project.qc_engineer_ids),
      siteSupervisor: getSingularVal(project.site_supervisor_id, project.site_supervisor_ids),
      crmExecutive: getSingularVal(project.crm_executive_id, project.crm_executive_ids),
      procurementOfficer: getSingularVal(project.procurement_officer_id, project.procurement_officer_ids),
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        pm_id: formData.pm || null,
        sales_rep_id: formData.salesRep || null,
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
      console.error('[TeamAndRolesTab] Save error:', err);
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update team');
    } finally {
      setSaving(false);
    }
  };

  const getRoleNames = (idOrIds, fallbackName, defaultName) => {
    if (typeof idOrIds === 'string' && idOrIds) {
      const match = teamMembers.find(m => m.id === idOrIds);
      if (match) return match.name;
    } else if (Array.isArray(idOrIds) && idOrIds.length > 0) {
      const matched = idOrIds.map(id => teamMembers.find(m => m.id === id)?.name).filter(Boolean);
      if (matched.length > 0) return matched.join(', ');
    }
    return fallbackName || defaultName || '—';
  };

  const fields = [
    { label: 'Project Manager', value: getRoleNames(project.pm_id, project.pm_name) },
    { label: 'Sales Representative', value: getRoleNames(project.sales_rep_id, project.sales_rep_name) },
    { label: 'Designer', value: getRoleNames(project.designer_id || project.designer_ids, project.designer_name) },
    { label: 'Lead Designer', value: getRoleNames(project.lead_designer_id || project.lead_designer_ids, project.lead_designer_name) },
    { label: 'Junior Designer', value: getRoleNames(project.junior_designer_id || project.junior_designer_ids, project.junior_designer_name) },
    { label: 'Site Engineer', value: getRoleNames(project.site_engineer_id || project.site_engineer_ids, project.site_engineer_name) },
    { label: 'QC Engineer', value: getRoleNames(project.qc_engineer_id || project.qc_engineer_ids, project.qc_engineer_name) },
    { label: 'Site Supervisor', value: getRoleNames(project.site_supervisor_id || project.site_supervisor_ids, project.site_supervisor_name) },
    { label: 'CRM Executive', value: getRoleNames(project.crm_executive_id || project.crm_executive_ids, project.crm_executive_name) },
    { label: 'Procurement Officer', value: getRoleNames(project.procurement_officer_id || project.procurement_officer_ids, project.procurement_officer_name) },
    ...(project.site_team || []).map(member => ({
      label: `${(member.role || 'Site Member').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}${member.vendor_name ? ` (${member.vendor_name})` : ''}`,
      value: member.name || '—'
    }))
  ];

  const getOptions = (roleKeywords) => {
    const filtered = teamMembers.filter(u => 
      !roleKeywords || roleKeywords.length === 0 || 
      roleKeywords.some(k => (u.role_name || '').toLowerCase().includes(k) || (u.role || '').toLowerCase().includes(k))
    );
    const listToUse = filtered.length > 0 ? filtered : teamMembers;
    return [
      { value: '', label: 'Select' },
      ...listToUse.map(u => ({ value: u.id, label: `${u.name}${u.role_name || u.role ? ` (${u.role_name || u.role})` : ''}` }))
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 0, marginRight: '-1px', marginBottom: '-1px' }}>
          {fields.map((f) => (
            <div key={f.label} style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--color-border)',
              borderRight: '1px solid var(--color-border)',
              boxSizing: 'border-box',
              minWidth: 0,
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
            label="Sales Representative" 
            options={getOptions(['sales', 'rep'])}
            value={formData.salesRep}
            onChange={v => setFormData({...formData, salesRep: v})}
          />
          <Select 
            label="Designer" 
            options={getOptions(['designer'])}
            value={formData.designer}
            onChange={v => setFormData({...formData, designer: v})}
          />
          <Select 
            label="Lead Designer" 
            options={getOptions(['lead'])}
            value={formData.leadDesigner}
            onChange={v => setFormData({...formData, leadDesigner: v})}
          />
          <Select 
            label="Junior Designer" 
            options={getOptions(['junior'])}
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
          <Button variant="outline" onClick={async () => setIsEditing(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
        </div>
      </Modal>
    </div>
  );
}
