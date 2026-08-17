import React, { useState } from 'react';
import { Modal, Button, Textarea } from '../ui';
import { deleteProject } from '../../api/projects';
import { useToast } from '../../store/toastContext';

export default function DeleteProjectModal({ projectId, isOpen, onClose, onSuccess }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return toast.error('Reason is required');

    setLoading(true);
    try {
      await deleteProject(projectId, { reason });
      toast.success('Project deleted successfully');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to delete project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Project">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '6px', border: '1px solid #fee2e2', fontSize: '0.85rem', color: '#991b1b' }}>
          <strong>Warning:</strong> Deleting this project is a destructive action. The project status will be marked as deleted and it will be hidden from normal operations.
        </div>
        <Textarea
          label="Reason for Deletion"
          placeholder="e.g. Duplicate project, cancelled by client before booking, etc..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          rows={4}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" disabled={loading}>
            {loading ? 'Deleting...' : 'Confirm Delete Project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
