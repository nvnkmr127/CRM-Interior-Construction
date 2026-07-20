import React, { useState, useEffect } from 'react';
import styles from './BulkActionBar.module.css'; // Re-use modal styles
import api from '../../../utils/api';
import { useToast } from '../../../contexts/ToastContext';

export default function AssignmentModal({ isOpen, onClose, approval, onSuccess }) {
  const [assignedTo, setAssignedTo] = useState('');
  const [backupApprover, setBackupApprover] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const toast = useToast();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data } = await api.get('/api/users?limit=50');
        setUsersList(data.data || data);
      } catch (err) {
        console.error('Failed to fetch users', err);
      }
    };
    if (isOpen) fetchUsers();
  }, [isOpen]);

  useEffect(() => {
    if (approval && isOpen) {
      setAssignedTo(approval.assigned_to || '');
      setBackupApprover(approval.backup_approver || '');
      setAssignmentNotes(approval.assignment_notes || '');
    }
  }, [approval, isOpen]);

  if (!isOpen || !approval) return null;

  const handleSubmit = async () => {
    if (!assignedTo) return toast.error('Primary Assignee is required.');
    
    setLoading(true);
    try {
      await api.post(`/api/financial-approvals/${approval.id}/assign`, {
        assigned_to: assignedTo,
        backup_approver: backupApprover,
        assignment_notes: assignmentNotes
      });
      toast.success('Assignment updated and notification dispatched!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error('Failed to assign approval.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} style={{ zIndex: 10000 }}>
      <div className={styles.modal} style={{ maxWidth: '500px' }}>
        <h3>Assign Approval</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Select the Primary and Backup approvers for {approval.transaction_type} #{approval.id.slice(0, 8)}.
        </p>
        
        <div style={{ marginTop: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Primary Assignee <span style={{color:'red'}}>*</span></label>
          <select 
            value={assignedTo} 
            onChange={e => setAssignedTo(e.target.value)}
            className={styles.textarea}
            style={{ minHeight: '40px', marginTop: 0 }}
          >
            <option value="">-- Select Assignee --</option>
            {usersList.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role_name || 'User'})</option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Backup Approver</label>
          <select 
            value={backupApprover} 
            onChange={e => setBackupApprover(e.target.value)}
            className={styles.textarea}
            style={{ minHeight: '40px', marginTop: 0 }}
          >
            <option value="">-- None --</option>
            {usersList.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role_name || 'User'})</option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Assignment Notes</label>
          <textarea 
            value={assignmentNotes} 
            onChange={e => setAssignmentNotes(e.target.value)} 
            placeholder="Add context for the approver..." 
            className={styles.textarea} 
            style={{ marginTop: 0 }}
          />
        </div>

        <div className={styles.modalActions}>
          <button onClick={onClose} disabled={loading}>Cancel</button>
          <button onClick={handleSubmit} className={styles.approve} disabled={loading || !assignedTo}>
            {loading ? 'Saving...' : 'Save Assignment'}
          </button>
        </div>
      </div>
    </div>
  );
}
