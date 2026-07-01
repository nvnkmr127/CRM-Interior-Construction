import React, { useState } from 'react';
import { Button, Modal, Input, Textarea } from '../ui';
import { updateProject } from '../../api/projects';
import { useToast } from '../../store/toastContext';

export default function SettingsTab({ project, onRefresh }) {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({});

  const openEdit = () => {
    setFormData({
      allowedDesignRevisions: project.allowed_design_revisions !== undefined ? project.allowed_design_revisions : 3,
      currentDesignRevisions: project.current_design_revisions !== undefined ? project.current_design_revisions : 0,
      projectNotes: project.notes || '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        allowed_design_revisions: formData.allowedDesignRevisions ? Number(formData.allowedDesignRevisions) : 3,
        current_design_revisions: formData.currentDesignRevisions ? Number(formData.currentDesignRevisions) : 0,
        notes: formData.projectNotes || null,
      };
      await updateProject(project.id, payload);
      toast.success('Settings updated successfully');
      setIsEditing(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { label: 'Allowed Design Revisions', value: project.allowed_design_revisions !== undefined && project.allowed_design_revisions !== null ? project.allowed_design_revisions : 3 },
    { label: 'Current Design Revisions', value: project.current_design_revisions !== undefined && project.current_design_revisions !== null ? project.current_design_revisions : 0 },
    { label: 'Project Notes', value: project.notes || '—' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
            Project Settings
          </div>
          <Button variant="outline" size="sm" onClick={openEdit}>
            ✏️ Edit
          </Button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0 }}>
          {fields.map((f, i) => (
            <div key={f.label} style={{
              padding: '14px 20px',
              borderBottom: i < fields.length - 1 ? '1px solid var(--color-border)' : 'none',
            }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {f.label}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
                {f.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title="Edit Settings" size="md">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', paddingBottom: '16px' }}>
          <Input 
            label="Allowed Design Revisions" 
            type="number"
            value={formData.allowedDesignRevisions}
            onChange={e => setFormData({...formData, allowedDesignRevisions: e.target.value})}
          />
          <Input 
            label="Current Design Revisions" 
            type="number"
            value={formData.currentDesignRevisions}
            onChange={e => setFormData({...formData, currentDesignRevisions: e.target.value})}
          />
          <Textarea 
            label="Project Notes" 
            placeholder="Any specific project notes..."
            value={formData.projectNotes}
            onChange={e => setFormData({...formData, projectNotes: e.target.value})}
            rows={4}
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
