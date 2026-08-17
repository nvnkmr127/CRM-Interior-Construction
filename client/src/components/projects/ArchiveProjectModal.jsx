import React, { useState } from 'react';
import { Modal, Button, Textarea } from '../ui';
import { archiveProject } from '../../api/projects';
import { useToast } from '../../store/toastContext';

export default function ArchiveProjectModal({ projectId, isOpen, onClose, onSuccess }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return toast.error('Reason is required');

    setLoading(true);
    try {
      await archiveProject(projectId, { reason });
      toast.success('Project archived successfully');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to archive project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Archive Project">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ padding: '12px', background: '#eff6ff', borderRadius: '6px', border: '1px solid #dbeafe', fontSize: '0.85rem', color: '#1e40af' }}>
          <strong>Note:</strong> Archiving this project will mark its status as "Archived". The project details and files will remain read-only for future reference.
        </div>
        <Textarea
          label="Reason for Archiving"
          placeholder="e.g. Project completed, handover done and warranty period started..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          rows={4}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Archiving...' : 'Confirm Archive Project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
