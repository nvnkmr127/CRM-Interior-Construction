import React, { useState } from 'react';
import { Button, PermissionButton, Modal, Textarea } from '../ui';
import api from '../../api/axios';

export default function ApprovalActions({ module, id, status, onActionComplete }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [actionType, setActionType] = useState(null); // 'approve' | 'reject' | 'request'
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAction = async () => {
    try {
      setLoading(true);
      await api.post(`/approvals/${module}/${id}/${actionType}`, { comments });
      setModalOpen(false);
      setComments('');
      if (onActionComplete) onActionComplete();
    } catch (err) {
      console.error('Action failed:', err);
      alert('Failed to process approval action.');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (type) => {
    setActionType(type);
    setModalOpen(true);
  };

  const isPending = status === 'pending';

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {/* Edit permission allows them to REQUEST approval if draft/rejected */}
      {(status === 'draft' || status === 'rejected') && (
        <PermissionButton module={module} action="edit">
          <Button variant="outline" size="sm" onClick={() => openModal('request')}>
            Submit for Approval
          </Button>
        </PermissionButton>
      )}

      {/* Approve permission allows them to APPROVE/REJECT if pending */}
      {isPending && (
        <PermissionButton module={module} action="approve">
          <>
            <Button variant="primary" size="sm" onClick={() => openModal('approve')}>
              Approve
            </Button>
            <Button variant="outline" size="sm" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => openModal('reject')}>
              Reject
            </Button>
          </>
        </PermissionButton>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={actionType === 'approve' ? 'Approve Record' : actionType === 'reject' ? 'Reject Record' : 'Request Approval'}
      >
        <div style={{ padding: '20px' }}>
          <p style={{ marginBottom: '16px' }}>
            Are you sure you want to {actionType} this record? You can leave an optional comment below.
          </p>
          <Textarea
            placeholder="Comments (optional)..."
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={4}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button 
              variant={actionType === 'reject' ? 'outline' : 'primary'} 
              style={actionType === 'reject' ? { color: 'var(--color-danger)', borderColor: 'var(--color-danger)' } : {}}
              onClick={handleAction} 
              loading={loading}
            >
              Confirm {actionType}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
