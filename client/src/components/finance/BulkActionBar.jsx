import React, { useState } from 'react';
import styles from './BulkActionBar.module.css';
import api from '../../../utils/api';

export default function BulkActionBar({ selectedIds, clearSelection, refreshData }) {
  const [loading, setLoading] = useState(false);
  const [resultsModal, setResultsModal] = useState(null); // { successful: [], failed: [] }
  const [confirmModal, setConfirmModal] = useState(null); // 'approve', 'reject', 'assign', 'priority'
  const [rejectReason, setRejectReason] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('high');
  const [usersList, setUsersList] = useState([]);

  useEffect(() => {
    if (confirmModal === 'assign' && usersList.length === 0) {
      api.get('/api/users?limit=50').then(({ data }) => setUsersList(data.data || data)).catch(() => {});
    }
  }, [confirmModal, usersList.length]);

  const count = selectedIds.size;
  if (count === 0 && !resultsModal) return null;

  const handleBulkAction = async (action, payload = {}) => {
    setLoading(true);
    try {
      const { data } = await api.post('/api/financial-approvals/bulk', {
        action,
        approvalIds: Array.from(selectedIds),
        payload
      });
      setResultsModal(data);
      if (data.failed?.length === 0) {
        clearSelection();
        refreshData();
        setTimeout(() => setResultsModal(null), 3000);
      } else {
        refreshData(); // Refresh anyway to update successful ones
      }
    } catch (err) {
      alert('Bulk action failed');
    } finally {
      setLoading(false);
      setConfirmModal(null);
    }
  };

  const handleExport = () => {
    const csvRows = ['ID,Status'];
    Array.from(selectedIds).forEach(id => {
      csvRows.push(`${id},Selected`);
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk_export_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    clearSelection();
  };

  return (
    <>
      {count > 0 && (
        <div className={styles.bar}>
          <div className={styles.left}>
            <span className={styles.countBadge}>{count} selected</span>
            <button className={styles.clearBtn} onClick={clearSelection}>Clear</button>
          </div>
          
          <div className={styles.actions}>
            <button className={`${styles.actionBtn} ${styles.approve}`} onClick={() => setConfirmModal('approve')} disabled={loading}>
              Approve
            </button>
            <button className={`${styles.actionBtn} ${styles.reject}`} onClick={() => setConfirmModal('reject')} disabled={loading}>
              Reject
            </button>
            <button className={styles.actionBtn} onClick={() => setConfirmModal('assign')} disabled={loading}>
              Assign
            </button>
            <button className={styles.actionBtn} onClick={() => handleBulkAction('archive')} disabled={loading}>
              Archive
            </button>
            <button className={styles.actionBtn} onClick={() => setConfirmModal('priority')} disabled={loading}>
              Change Priority
            </button>
            <button className={styles.actionBtn} onClick={handleExport} disabled={loading}>
              Export
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modals */}
      {confirmModal === 'approve' && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3>Confirm Bulk Approval</h3>
            <p>Are you sure you want to approve {count} selected requests?</p>
            <div className={styles.modalActions}>
              <button onClick={() => setConfirmModal(null)}>Cancel</button>
              <button onClick={() => handleBulkAction('approve')} className={styles.approve}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {confirmModal === 'reject' && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3>Confirm Bulk Rejection</h3>
            <p>Please provide a reason for rejecting {count} requests:</p>
            <textarea 
              value={rejectReason} 
              onChange={e => setRejectReason(e.target.value)} 
              placeholder="Rejection reason..." 
              className={styles.textarea} 
            />
            <div className={styles.modalActions}>
              <button onClick={() => setConfirmModal(null)}>Cancel</button>
              <button onClick={() => handleBulkAction('reject', { reason: rejectReason })} className={styles.reject} disabled={!rejectReason}>Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}

      {confirmModal === 'assign' && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3>Assign Selected Requests</h3>
            <p>Select a user to assign these {count} requests to:</p>
            <select 
              value={assigneeId} 
              onChange={e => setAssigneeId(e.target.value)}
              className={styles.textarea}
              style={{ minHeight: '40px', marginBottom: '16px' }}
            >
              <option value="">-- Select Assignee --</option>
              {usersList.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role_name || 'User'})</option>
              ))}
            </select>
            <div className={styles.modalActions}>
              <button onClick={() => setConfirmModal(null)}>Cancel</button>
              <button onClick={() => handleBulkAction('assign', { assignee_id: assigneeId })} className={styles.approve} disabled={!assigneeId}>Assign</button>
            </div>
          </div>
        </div>
      )}

      {confirmModal === 'priority' && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3>Change Priority</h3>
            <p>Select a new priority level for these {count} requests:</p>
            <select 
              value={selectedPriority} 
              onChange={e => setSelectedPriority(e.target.value)}
              className={styles.textarea}
              style={{ minHeight: '40px', marginBottom: '16px' }}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <div className={styles.modalActions}>
              <button onClick={() => setConfirmModal(null)}>Cancel</button>
              <button onClick={() => handleBulkAction('change_priority', { priority: selectedPriority })} className={styles.approve}>Update Priority</button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className={styles.overlay} style={{ zIndex: 10000 }}>
          <div className={styles.loadingBox}>
            <div className={styles.spinner}></div>
            <p>Processing {count} items...</p>
          </div>
        </div>
      )}

      {/* Partial Success / Results Modal */}
      {resultsModal && resultsModal.failed?.length > 0 && (
        <div className={styles.overlay} style={{ zIndex: 9999 }}>
          <div className={styles.modal} style={{ maxWidth: '500px' }}>
            <h3>Partial Success</h3>
            <p><strong>{resultsModal.successful?.length}</strong> items were processed successfully.</p>
            <p style={{ color: '#dc2626' }}><strong>{resultsModal.failed?.length}</strong> items failed:</p>
            
            <ul className={styles.errorList}>
              {resultsModal.failed.map((f, i) => (
                <li key={i}>ID {f.id.slice(0,8)}... : {f.error}</li>
              ))}
            </ul>
            
            <div className={styles.modalActions}>
              <button onClick={() => { setResultsModal(null); clearSelection(); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
