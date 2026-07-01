import React, { useState, useEffect } from 'react';
import { Button, Input, Modal } from '../ui';
import { previewCancellation, cancelProject } from '../../api/projects';

export default function CancelProjectModal({ projectId, isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  
  const [reason, setReason] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [refundOverride, setRefundOverride] = useState('');
  const [recoverOverride, setRecoverOverride] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && projectId) {
      setLoading(true);
      setError(null);
      previewCancellation(projectId)
        .then(res => {
          setPreviewData(res.data?.data || res.data);
        })
        .catch(err => {
          setError(err.response?.data?.message || 'Failed to fetch cancellation preview');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, projectId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Cancellation reason is required.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await cancelProject(projectId, {
        reason,
        settlementNotes,
        refundOverride: refundOverride ? Number(refundOverride) : null,
        recoverOverride: recoverOverride ? Number(recoverOverride) : null
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel project');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cancel Project & Financial Settlement">
      <div style={{ width: 500, maxWidth: '100%' }}>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Calculating financial settlement preview...
          </div>
        ) : error ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-danger)' }}>
            {error}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '16px'
            }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 'var(--text-md)' }}>Financial Settlement Preview</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 'var(--text-sm)' }}>
                <div><strong>Total Advance Paid:</strong></div>
                <div style={{ textAlign: 'right' }}>{formatCurrency(previewData?.totalPaid)}</div>
                
                <div><strong>Completed Work Value:</strong></div>
                <div style={{ textAlign: 'right' }}>{formatCurrency(previewData?.completedWorkValue)}</div>
                
                <div><strong>Material Cost Incurred:</strong></div>
                <div style={{ textAlign: 'right' }}>{formatCurrency(previewData?.materialCost)}</div>
                
                <hr style={{ gridColumn: 'span 2', borderColor: 'var(--color-border)' }} />
                
                <div><strong style={{ color: previewData?.refundAmount > 0 ? 'var(--color-warning)' : 'var(--color-text)' }}>Computed Refund Due:</strong></div>
                <div style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(previewData?.refundAmount)}</div>
                
                <div><strong style={{ color: previewData?.recoverAmount > 0 ? 'var(--color-danger)' : 'var(--color-text)' }}>Computed Recovery Due:</strong></div>
                <div style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(previewData?.recoverAmount)}</div>
              </div>
            </div>

            <Input 
              label="Cancellation Reason *" 
              value={reason} 
              onChange={e => setReason(e.target.value)} 
              placeholder="e.g. Client requested cancellation due to funding issues..."
              required
            />
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input 
                label="Override Refund Amount (Optional)" 
                type="number"
                min="0"
                step="0.01"
                value={refundOverride} 
                onChange={e => setRefundOverride(e.target.value)} 
                placeholder="0.00"
              />
              <Input 
                label="Override Recovery Amount (Optional)" 
                type="number"
                min="0"
                step="0.01"
                value={recoverOverride} 
                onChange={e => setRecoverOverride(e.target.value)} 
                placeholder="0.00"
              />
            </div>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '-10px 0 0 0' }}>
              Note: Providing an override will replace the computed settlement amount for documentation.
            </p>

            <Input 
              label="Settlement Notes" 
              value={settlementNotes} 
              onChange={e => setSettlementNotes(e.target.value)} 
              placeholder="Any agreed terms regarding the final settlement..."
              as="textarea"
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Back</Button>
              <Button type="submit" variant="primary" style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} disabled={submitting || !reason.trim()}>
                {submitting ? 'Cancelling...' : 'Confirm Cancellation'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
