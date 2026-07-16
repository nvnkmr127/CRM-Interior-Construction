/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { Button, Input, Modal } from '../ui';
import { updateProject } from '../../api/projects';
import { useToast } from '../../store/toastContext';

export default function ClientProfileTab({ project, onRefresh }) {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({});

  const openEdit = () => {
    setFormData({
      clientPhone: project.client_phone || '',
      clientEmail: project.client_email || '',
      spouseName: project.spouse_name || '',
      spousePhone: project.spouse_phone || '',
      spouseEmail: project.spouse_email || '',
      numberOfFamilyMembers: project.number_of_family_members || '',
      lifestylePreferences: project.lifestyle_preferences || '',
      preferredCommunicationChannel: project.preferred_communication_channel || '',
      agreementSignedBy: project.agreement_signed_by || '',
      agreementSignedAt: project.agreement_signed_at ? project.agreement_signed_at.split('T')[0] : '',
      agreementSignatureMethod: project.agreement_signature_method || '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        client_phone: formData.clientPhone || null,
        client_email: formData.clientEmail || null,
        spouse_name: formData.spouseName || null,
        spouse_phone: formData.spousePhone || null,
        spouse_email: formData.spouseEmail || null,
        number_of_family_members: formData.numberOfFamilyMembers ? Number(formData.numberOfFamilyMembers) : null,
        lifestyle_preferences: formData.lifestylePreferences || null,
        preferred_communication_channel: formData.preferredCommunicationChannel || null,
        agreement_signed_by: formData.agreementSignedBy || null,
        agreement_signed_at: formData.agreementSignedAt || null,
        agreement_signature_method: formData.agreementSignatureMethod || null,
      };
      await updateProject(project.id, payload);
      toast.success('Client Profile updated successfully');
      setIsEditing(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error('Failed to update client profile');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const fields = [
    { label: 'Client Phone', value: project.client_phone || '—' },
    { label: 'Client Email', value: project.client_email || '—' },
    { label: 'Spouse Name', value: project.spouse_name || '—' },
    { label: 'Spouse Phone', value: project.spouse_phone || '—' },
    { label: 'Spouse Email', value: project.spouse_email || '—' },
    { label: 'Number of Family Members', value: project.number_of_family_members || '—' },
    { label: 'Preferred Comm. Channel', value: project.preferred_communication_channel || '—' },
    { label: 'Lifestyle Preferences', value: project.lifestyle_preferences || '—' },
    { label: 'Agreement Signed By', value: project.agreement_signed_by || '—' },
    { label: 'Agreement Signed Date', value: formatDate(project.agreement_signed_at) },
    { label: 'Signature Method', value: project.agreement_signature_method ? project.agreement_signature_method.replace(/_/g, ' ') : '—' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
            Client Profile
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

      <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title="Edit Client Profile" size="md">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingBottom: '16px' }}>
          <Input 
            label="Client Phone" 
            value={formData.clientPhone}
            onChange={e => setFormData({...formData, clientPhone: e.target.value})}
          />
          <Input 
            label="Client Email" 
            type="email"
            value={formData.clientEmail}
            onChange={e => setFormData({...formData, clientEmail: e.target.value})}
          />
          <Input 
            label="Spouse Name" 
            value={formData.spouseName}
            onChange={e => setFormData({...formData, spouseName: e.target.value})}
          />
          <Input 
            label="Spouse Phone" 
            value={formData.spousePhone}
            onChange={e => setFormData({...formData, spousePhone: e.target.value})}
          />
          <Input 
            label="Spouse Email" 
            type="email"
            value={formData.spouseEmail}
            onChange={e => setFormData({...formData, spouseEmail: e.target.value})}
          />
          <Input 
            label="Number of Family Members" 
            type="number"
            value={formData.numberOfFamilyMembers}
            onChange={e => setFormData({...formData, numberOfFamilyMembers: e.target.value})}
          />
          <Input 
            label="Preferred Communication Channel" 
            placeholder="e.g. WhatsApp, Email"
            value={formData.preferredCommunicationChannel}
            onChange={e => setFormData({...formData, preferredCommunicationChannel: e.target.value})}
          />
          <div style={{ gridColumn: '1 / -1' }}>
            <Input 
              label="Lifestyle Preferences / Notes" 
              placeholder="Any specific lifestyle choices affecting design..."
              value={formData.lifestylePreferences}
              onChange={e => setFormData({...formData, lifestylePreferences: e.target.value})}
            />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
          <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
        </div>
      </Modal>
    </div>
  );
}
