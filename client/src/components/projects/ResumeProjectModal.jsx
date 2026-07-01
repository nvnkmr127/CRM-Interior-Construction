import React, { useState } from 'react';
import { Modal, Button } from '../ui';
import { resumeProject } from '../../api/projects';
import { useToast } from '../../store/toastContext';

export default function ResumeProjectModal({ projectId, isOpen, onClose, onSuccess }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [checks, setChecks] = useState({
    siteConditionVerified: false,
    materialStatusVerified: false
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!checks.siteConditionVerified || !checks.materialStatusVerified) {
      return toast.error('Please verify all checklist items before resuming');
    }

    setLoading(true);
    try {
      await resumeProject(projectId, checks);
      toast.success('Project resumed successfully');
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to resume project');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = checks.siteConditionVerified && checks.materialStatusVerified;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Resume Project">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text)' }}>
          Please complete the following checks before formally resuming the project execution:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--color-background-alt)', padding: '16px', borderRadius: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={checks.siteConditionVerified}
              onChange={(e) => setChecks({ ...checks, siteConditionVerified: e.target.checked })}
              style={{ width: '18px', height: '18px' }}
            />
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
              Site condition has been re-verified.
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={checks.materialStatusVerified}
              onChange={(e) => setChecks({ ...checks, materialStatusVerified: e.target.checked })}
              style={{ width: '18px', height: '18px' }}
            />
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
              Material status and inventory have been verified.
            </span>
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading || !isFormValid}>
            {loading ? 'Resuming...' : 'Confirm Resume Project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
