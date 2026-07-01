import React, { useState } from 'react';
import { Button, Modal, Textarea } from '../ui';
import { updateProject } from '../../api/projects';
import { useToast } from '../../store/toastContext';

export default function VendorsAndConsultantsTab({ project, onRefresh }) {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({});

  const openEdit = () => {
    setFormData({
      vendors: project.vendors || '',
      consultants: project.consultants || '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        vendors: formData.vendors || null,
        consultants: formData.consultants || null,
      };
      await updateProject(project.id, payload);
      toast.success('Vendors & Consultants updated successfully');
      setIsEditing(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error('Failed to update vendors & consultants');
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { label: 'Assigned Vendors', value: project.vendors || 'No vendors assigned' },
    { label: 'Assigned Consultants', value: project.consultants || 'No consultants assigned' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
            Vendors & Consultants
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

      <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title="Edit Vendors & Consultants" size="md">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', paddingBottom: '16px' }}>
          <Textarea 
            label="Vendors" 
            placeholder="List vendors assigned to this project..."
            value={formData.vendors}
            onChange={e => setFormData({...formData, vendors: e.target.value})}
            rows={4}
          />
          <Textarea 
            label="Consultants" 
            placeholder="List consultants assigned to this project..."
            value={formData.consultants}
            onChange={e => setFormData({...formData, consultants: e.target.value})}
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
