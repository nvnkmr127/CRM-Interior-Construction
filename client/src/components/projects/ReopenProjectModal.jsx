/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { Modal, Input, Button } from '../ui';
import { useToast } from '../../store/toastContext';
import { reopenProject } from '../../api/projects';

export default function ReopenProjectModal({
  projectId,
  currentStartDate,
  currentTargetDate,
  isOpen,
  onClose,
  onSuccess
}) {
  const toast = useToast();
  const [newStartDate, setNewStartDate] = useState('');
  const [newTargetDate, setNewTargetDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Set to current dates, or format nicely
      const formatDate = (dateStr) => {
        if (!dateStr) return '';
        try {
          return new Date(dateStr).toISOString().split('T')[0];
        } catch {
          return '';
        }
      };
      
      setNewStartDate(formatDate(currentStartDate));
      setNewTargetDate(formatDate(currentTargetDate));
    }
  }, [isOpen, currentStartDate, currentTargetDate]);

  const handleSubmit = async () => {
    if (!newStartDate) {
      toast.error('Please specify a new project start date');
      return;
    }

    try {
      setSubmitting(true);
      
      const payload = {
        newStartDate,
        newTargetDate: newTargetDate || null
      };

      await reopenProject(projectId, payload);
      toast.success('Project reopened and revived successfully!');
      
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      console.error('[ReopenProjectModal] Error reopening project:', err);
      toast.error(err?.response?.data?.error?.message || 'Failed to reopen project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reopen Project & Shift Timelines"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Reopening Project...' : 'Reopen & Shift Schedule'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{
          padding: '12px 16px',
          background: 'var(--color-accent-bg, #eff6ff)',
          border: '1px solid var(--color-accent-border, #bfdbfe)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-accent-text, #1e40af)'
        }}>
          💡 <strong>Timeline Re-indexing:</strong> Reopening the project will shift the start dates of all existing tasks, milestones, and phases based on the new start date to keep schedules intact.
        </div>

        <Input
          type="date"
          label="New Project Start Date *"
          value={newStartDate}
          onChange={setNewStartDate}
          required
        />

        <Input
          type="date"
          label="New Project Target Date (Optional)"
          value={newTargetDate}
          onChange={setNewTargetDate}
          helperText="Shift/extend the deadline for completion"
        />
      </div>
    </Modal>
  );
}
