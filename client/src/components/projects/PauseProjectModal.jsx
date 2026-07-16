/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { Modal, Button, Input, Textarea } from '../ui';
import { pauseProject } from '../../api/projects';
import { useToast } from '../../store/toastContext';

export default function PauseProjectModal({ projectId, isOpen, onClose, onSuccess }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    reason: '',
    expectedResumeDate: '',
    resourceReleaseInstructions: '',
    siteSecurityPlan: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.reason.trim()) return toast.error('Reason is required');

    setLoading(true);
    try {
      await pauseProject(projectId, form);
      toast.success('Project paused successfully');
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to pause project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pause Project">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '6px', border: '1px solid #fef3c7', fontSize: '0.85rem', color: '#92400e' }}>
          <strong>Note:</strong> Pausing this project will immediately deactivate all allocated site team members and flag the project as "On Hold" across all reports.
        </div>
        <Textarea
          label="Reason for Pause"
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          required
          rows={3}
        />
        <Input
          type="date"
          label="Expected Resume Date"
          value={form.expectedResumeDate}
          onChange={(e) => setForm({ ...form, expectedResumeDate: e.target.value })}
        />
        <Textarea
          label="Resource Release Instructions"
          value={form.resourceReleaseInstructions}
          onChange={(e) => setForm({ ...form, resourceReleaseInstructions: e.target.value })}
          rows={3}
          placeholder="e.g. Relocate carpenters to Project X..."
        />
        <Textarea
          label="Site Security Plan (if applicable)"
          value={form.siteSecurityPlan}
          onChange={(e) => setForm({ ...form, siteSecurityPlan: e.target.value })}
          rows={3}
          placeholder="e.g. Lock main door, keys handed over to society office..."
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Pausing...' : 'Confirm Pause Project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
