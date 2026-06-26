import { useState, useEffect } from 'react';
import { Modal, Input, Select, Button } from '../ui';
import { useToast } from '../../store/toastContext';
import { replaceProjectResource } from '../../api/projects';
import api from '../../api/axios';

export default function HandoverModal({ 
  projectId, 
  role, 
  currentResourceId, 
  currentResourceName, 
  isOpen, 
  onClose, 
  onSuccess 
}) {
  const toast = useToast();
  const [teamMembers, setTeamMembers] = useState([]);
  const [newResourceId, setNewResourceId] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [notifyClient, setNotifyClient] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.get('/users?limit=100')
        .then(res => {
          const u = res.data?.data || res.data || [];
          setTeamMembers(Array.isArray(u) ? u : []);
        })
        .catch(err => console.error('Failed to fetch team members', err));
      
      // Reset state
      setNewResourceId('');
      setHandoverNotes('');
      setNotifyClient(true);
    }
  }, [isOpen]);

  // Filter candidates by role (excluding current resource)
  const eligibleUsers = teamMembers.filter(u => 
    u.id !== currentResourceId && 
    (role === 'pm' ? u.role === 'pm' : u.role === 'designer')
  );

  const displayUsers = eligibleUsers.length > 0 
    ? eligibleUsers 
    : teamMembers.filter(u => u.id !== currentResourceId);

  const handleSubmit = async () => {
    if (!newResourceId) {
      toast.error('Please select a replacement team member');
      return;
    }
    if (!handoverNotes.trim()) {
      toast.error('Please provide handover notes outlining the project state');
      return;
    }

    setSubmitting(false);
    try {
      setSubmitting(true);
      await replaceProjectResource(projectId, {
        role,
        newResourceId,
        handoverNotes: handoverNotes.trim(),
        clientNotified: notifyClient
      });
      toast.success(`${role === 'pm' ? 'Project Manager' : 'Designer'} replaced successfully`);
      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to replace resource');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Mid-Project ${role === 'pm' ? 'Project Manager' : 'Designer'} Handover`}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Processing Handover...' : 'Execute Replacement'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{
          padding: '12px 16px',
          background: 'var(--color-surface-hover, #f8fafc)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-secondary)'
        }}>
          Replacing current {role === 'pm' ? 'Project Manager' : 'Designer'}: <strong>{currentResourceName || 'Unassigned'}</strong>
        </div>

        <Select
          label={`Select New ${role === 'pm' ? 'Project Manager' : 'Designer'} *`}
          value={newResourceId}
          onChange={setNewResourceId}
          options={[
            { value: '', label: `Select replacement (${role === 'pm' ? 'PM' : 'Designer'})` },
            ...displayUsers.map(u => ({
              value: u.id,
              label: `${u.name} (${u.role ? u.role.toUpperCase() : 'TEAM'})`
            }))
          ]}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Handover Briefing & Notes *
          </label>
          <textarea
            placeholder="Document current project status, client preferences, pending design components, milestones reached, and next steps..."
            value={handoverNotes}
            onChange={e => setHandoverNotes(e.target.value)}
            style={{
              width: '100%',
              minHeight: 120,
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontSize: 'var(--text-sm)',
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit'
            }}
          />
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '12px',
          background: 'var(--color-accent-bg, #eff6ff)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-accent-border, #bfdbfe)'
        }}>
          <input
            type="checkbox"
            id="notifyClient"
            checked={notifyClient}
            onChange={e => setNotifyClient(e.target.checked)}
            style={{ marginTop: 3, cursor: 'pointer' }}
          />
          <label htmlFor="notifyClient" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent-text, #1e40af)', cursor: 'pointer', lineHeight: 1.4 }}>
            <strong>Notify Client Automatically:</strong> Trigger system email and SMS to update client of their new point of contact and share new briefing details.
          </label>
        </div>
      </div>
    </Modal>
  );
}
