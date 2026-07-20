import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import styles from './ApprovalComments.module.css'; // Reusing modal styles

export default function AssignmentModal({ isOpen, approval, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [comments, setComments] = useState('');
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/api/users?role=finance'); // Adjust endpoint to your actual users list
      setUsers(res.data.data || []);
    } catch (e) {
      console.error('Failed to fetch users');
    }
  };

  if (!isOpen || !approval) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) {
      toast.error('Please select a user to assign to.');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/api/financial-approvals/${approval.id}/assign`, {
        assigned_to: selectedUser,
        comments: comments
      });
      toast.success('Approval reassigned successfully.');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reassign.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal} style={{ maxWidth: '400px' }}>
        <h3 style={{ marginTop: 0 }}>Reassign Approval</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Assigning {approval.transaction_type} #{approval.reference_id} to another reviewer.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Assign To</label>
            <select 
              value={selectedUser} 
              onChange={(e) => setSelectedUser(e.target.value)}
              className={styles.input}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
              required
            >
              <option value="">-- Select Finance User --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
              ))}
              {/* Fallback mock users if API is empty */}
              {users.length === 0 && (
                <>
                  <option value="991">Finance Manager (Mock)</option>
                  <option value="992">CFO (Mock)</option>
                </>
              )}
            </select>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Reason / Notes</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className={styles.input}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', minHeight: '80px' }}
              placeholder="Why is this being reassigned?"
            ></textarea>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className={styles.secondaryBtn} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={loading}>
              {loading ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
