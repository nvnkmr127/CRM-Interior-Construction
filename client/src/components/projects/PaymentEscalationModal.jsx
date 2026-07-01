import React, { useState } from 'react';
import { Modal, Button } from '../../components/ui';
import { triggerPaymentEscalation } from '../../api/projects';

export default function PaymentEscalationModal({ isOpen, onClose, onSuccess, projectId, milestone, daysOverdue }) {
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');

  if (!isOpen || !milestone) return null;

  // Determine available escalation levels based on days overdue
  let availableLevel = null;
  let actionText = '';
  
  if (daysOverdue >= 60) {
    availableLevel = '60_days_lockout';
    actionText = 'Restrict Site Access (60+ Days Overdue)';
  } else if (daysOverdue >= 45) {
    availableLevel = '45_days_legal';
    actionText = 'Notify Legal Team (45+ Days Overdue)';
  } else if (daysOverdue >= 30) {
    availableLevel = '30_days_hold';
    actionText = 'Put Project on Financial Hold (30+ Days Overdue)';
  } else if (daysOverdue >= 15) {
    availableLevel = '15_days_alert';
    actionText = 'Send Escalation Alert (15+ Days Overdue)';
  } else {
    actionText = 'No escalation available yet (Needs to be at least 15 days overdue)';
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!availableLevel) return;
    
    setLoading(true);
    try {
      await triggerPaymentEscalation(projectId, {
        payment_milestone_id: milestone.id,
        escalation_level: availableLevel,
        notes
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to trigger payment escalation:', error);
      alert('Failed to trigger payment escalation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Authorize Payment Escalation">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        <div style={{ padding: '12px', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: '4px' }}>Milestone: {milestone.name}</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            Due Date: {new Date(milestone.due_date).toLocaleDateString()}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)', fontWeight: 600, marginTop: '8px' }}>
            {daysOverdue} Days Overdue
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: 'var(--text-sm)' }}>
            Proposed Action
          </label>
          <div style={{ padding: '12px', background: 'var(--color-warning-bg)', color: 'var(--color-warning)', borderRadius: 'var(--radius-md)', fontWeight: 600 }}>
            {actionText}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: 'var(--text-sm)' }}>
            Authorization Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{
              width: '100%',
              minHeight: '100px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)'
            }}
            placeholder="Add context for this escalation..."
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
          <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={loading || !availableLevel}>
            {loading ? 'Authorizing...' : 'Authorize Escalation'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
