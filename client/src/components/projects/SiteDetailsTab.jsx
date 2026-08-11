/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { Button, Input, Modal, Select } from '../ui';
import { updateProject } from '../../api/projects';
import { useToast } from '../../store/toastContext';

export default function SiteDetailsTab({ project, onRefresh }) {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({});

  const openEdit = () => {
    setFormData({
      siteAddress: project.site_address || '',
      flatNumber: project.flat_number || '',
      floor: project.floor || '',
      buildingName: project.building_name || '',
      street: project.street || '',
      landmark: project.landmark || '',
      city: project.city || '',
      pincode: project.pincode || '',
      latitude: project.latitude || '',
      longitude: project.longitude || '',
      renovationScope: project.renovation_scope || '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        site_address: formData.siteAddress || null,
        flat_number: formData.flatNumber || null,
        floor: formData.floor || null,
        building_name: formData.buildingName || null,
        street: formData.street || null,
        landmark: formData.landmark || null,
        city: formData.city || null,
        pincode: formData.pincode || null,
        latitude: formData.latitude || null,
        longitude: formData.longitude || null,
        renovation_scope: formData.renovationScope || null,
      };
      await updateProject(project.id, payload);
      toast.success('Site Details updated successfully');
      setIsEditing(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error('Failed to update site details');
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { label: 'Site Address', value: project.site_address || '—' },
    { label: 'Flat / Unit No', value: project.flat_number || '—' },
    { label: 'Floor', value: project.floor || '—' },
    { label: 'Building Name', value: project.building_name || '—' },
    { label: 'Street', value: project.street || '—' },
    { label: 'Landmark', value: project.landmark || '—' },
    { label: 'City', value: project.city || '—' },
    { label: 'Pincode', value: project.pincode || '—' },
    { label: 'GPS Coordinates', value: project.latitude && project.longitude ? `${project.latitude}, ${project.longitude}` : '—' },
    { label: 'Renovation Scope', value: project.renovation_scope ? project.renovation_scope.replace(/_/g, ' ') : '—' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
            Site Details & Permissions
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

      <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title="Edit Site Details" size="lg">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingBottom: '16px' }}>
          <Input label="Site Address" value={formData.siteAddress} onChange={e => setFormData({...formData, siteAddress: e.target.value})} />
          <Input label="Flat / Unit No" value={formData.flatNumber} onChange={e => setFormData({...formData, flatNumber: e.target.value})} />
          <Input label="Floor" value={formData.floor} onChange={e => setFormData({...formData, floor: e.target.value})} />
          <Input label="Building Name" value={formData.buildingName} onChange={e => setFormData({...formData, buildingName: e.target.value})} />
          <Input label="Street" value={formData.street} onChange={e => setFormData({...formData, street: e.target.value})} />
          <Input label="Landmark" value={formData.landmark} onChange={e => setFormData({...formData, landmark: e.target.value})} />
          <Input label="City" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
          <Input label="Pincode" value={formData.pincode} onChange={e => setFormData({...formData, pincode: e.target.value})} />
          <Input label="Latitude" value={formData.latitude} onChange={e => setFormData({...formData, latitude: e.target.value})} />
          <Input label="Longitude" value={formData.longitude} onChange={e => setFormData({...formData, longitude: e.target.value})} />
          <Input label="Renovation Scope" value={formData.renovationScope} onChange={e => setFormData({...formData, renovationScope: e.target.value})} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
          <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
        </div>
      </Modal>
    </div>
  );
}
