/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { Button } from '../ui';
import { createMilestone } from '../../api/projects';
import { createPaymentMilestone } from '../../api/paymentMilestones';
import { useToast } from '../../store/toastContext';

export default function AddMilestoneModal({
  isOpen,
  onClose,
  phase,
  projectId,
  project,
  onSuccess
}) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [triggersPayment, setTriggersPayment] = useState(false);
  const [paymentPercent, setPaymentPercent] = useState(20);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentName, setPaymentName] = useState('');

  const contractBudget = Number(project?.contract_value || project?.budget || project?.estimated_cost || 0);

  if (!isOpen || !phase) return null;

  const handlePercentChange = (val) => {
    setPaymentPercent(val);
    if (contractBudget > 0) {
      const pct = parseFloat(val) || 0;
      setPaymentAmount(Math.round((contractBudget * pct) / 100));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a milestone name');
      return;
    }

    setSubmitting(true);
    try {
      const sortOrder = (phase.milestones?.length || 0) + 1;
      const mRes = await createMilestone(phase.id, {
        name: name.trim(),
        due_date: dueDate || null,
        triggers_payment: Boolean(triggersPayment),
        sort_order: sortOrder
      });

      const createdMilestone = mRes.data?.data || mRes.data;

      if (triggersPayment && createdMilestone?.id) {
        const finalAmount = paymentAmount ? Number(paymentAmount) : (contractBudget > 0 && paymentPercent ? (contractBudget * Number(paymentPercent)) / 100 : null);
        await createPaymentMilestone({
          projectId,
          name: paymentName?.trim() || name.trim(),
          amount: finalAmount,
          percent: paymentPercent ? Number(paymentPercent) : null,
          dueDate: dueDate || null,
          milestoneId: createdMilestone.id,
          notes: `Checkpoint added to phase: ${phase.name}`
        }).catch(err => {
          console.warn('Payment milestone notice:', err);
        });
      }

      toast.success(`Checkpoint "${name}" added to ${phase.name}!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to add milestone:', err);
      toast.error(err?.response?.data?.error?.message || 'Failed to add milestone');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div style={{
        background: 'var(--color-surface, #ffffff)',
        borderRadius: 'var(--radius-lg, 12px)',
        width: '100%',
        maxWidth: '520px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>
              ➕ Add Checkpoint to {phase.name}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Define a new physical checkpoint or client payment trigger for this stage.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: 'var(--color-text-muted)'
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
              Checkpoint Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Living room Italian marble polish approved"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
              Target Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Payment Trigger Checkbox */}
          <div style={{
            background: 'var(--color-surface-hover, #f8fafc)',
            padding: '14px',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={triggersPayment}
                onChange={e => setTriggersPayment(e.target.checked)}
              />
              <span>💰 Triggers Client Payment Installment</span>
            </label>

            {triggersPayment && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                      Stage Percentage
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={paymentPercent}
                      onChange={e => handlePercentChange(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--color-border)',
                        fontSize: '12px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  {contractBudget > 0 && (
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                        Calculated Amount
                      </label>
                      <div style={{
                        padding: '8px 10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--color-success, #22c55e)',
                        background: 'var(--color-success-bg, rgba(34, 197, 94, 0.1))',
                        borderRadius: '6px'
                      }}>
                        ₹{(paymentAmount ? Number(paymentAmount) : Math.round((contractBudget * (paymentPercent || 0)) / 100)).toLocaleString('en-IN')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add Checkpoint'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
