import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

export default function AssignmentModal({ isOpen, approval, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [fetchingUsers, setFetchingUsers] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [backupUser, setBackupUser] = useState('');
  const [comments, setComments] = useState('');
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setSelectedUser(approval?.assigned_to || '');
      setBackupUser(approval?.backup_approver || '');
      setComments(approval?.assignment_notes || '');
    } else {
      setSelectedUser('');
      setBackupUser('');
      setComments('');
    }
  }, [isOpen, approval]);

  const fetchUsers = async () => {
    setFetchingUsers(true);
    try {
      const res = await api.get('/users?limit=100');
      const data = res.data?.data;
      const list = Array.isArray(data) ? data : (Array.isArray(res.data) ? res.data : []);
      setUsers(list);
    } catch (e) {
      console.error('Failed to fetch users:', e);
      toast.error('Failed to load user list');
    } finally {
      setFetchingUsers(false);
    }
  };

  if (!isOpen || !approval) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) {
      toast.error('Please select a primary user to assign.');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/financial-approvals/${approval.id}/assign`, {
        assigned_to: selectedUser,
        backup_approver: backupUser || null,
        assignment_notes: comments
      });
      toast.success('Approval reassigned successfully.');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to reassign approval.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnassign = async () => {
    setLoading(true);
    try {
      await api.post(`/financial-approvals/${approval.id}/assign`, {
        assigned_to: null,
        backup_approver: null,
        assignment_notes: null
      });
      toast.success('Assignment removed successfully.');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to remove assignment.');
    } finally {
      setLoading(false);
    }
  };

  const getUserLabel = (u) => {
    const name = u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'User';
    const role = u.role_name || (typeof u.role === 'string' ? u.role : u.role?.name) || 'Member';
    return `${name} (${role})`;
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px'
      }}
    >
      <div 
        style={{
          background: 'var(--color-surface, #ffffff)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: 'var(--shadow-lg, 0 10px 25px -5px rgba(0,0,0,0.1))',
          border: '1px solid var(--color-border, #e5e7eb)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        <div 
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border, #e5e7eb)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--color-bg, #f9fafb)'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-text, #111827)' }}>
            👤 Reassign Approval
          </h3>
          <button 
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: 'var(--color-text-muted, #6b7280)',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <div 
            style={{
              background: 'var(--color-bg, #f3f4f6)',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '0.875rem',
              color: 'var(--color-text, #374151)'
            }}
          >
            Assigning <strong>{(approval.transaction_type || 'approval').replace(/_/g, ' ')}</strong> #{approval.target_number || approval.id?.substring(0, 8)} for <strong>₹{parseFloat(approval.amount || 0).toLocaleString()}</strong>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text, #374151)' }}>
              Primary Approver <span style={{ color: 'var(--color-danger, #ef4444)' }}>*</span>
            </label>
            <select 
              value={selectedUser} 
              onChange={(e) => setSelectedUser(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid var(--color-border, #d1d5db)',
                background: 'var(--color-surface, #ffffff)',
                fontSize: '0.875rem',
                color: 'var(--color-text, #111827)',
                outline: 'none'
              }}
              required
              disabled={fetchingUsers}
            >
              <option value="">{fetchingUsers ? 'Loading users...' : '-- Select Primary Approver --'}</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{getUserLabel(u)}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text, #374151)' }}>
              Backup Approver (Optional)
            </label>
            <select 
              value={backupUser} 
              onChange={(e) => setBackupUser(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid var(--color-border, #d1d5db)',
                background: 'var(--color-surface, #ffffff)',
                fontSize: '0.875rem',
                color: 'var(--color-text, #111827)',
                outline: 'none'
              }}
              disabled={fetchingUsers}
            >
              <option value="">-- None (No Backup) --</option>
              {users.filter(u => u.id !== selectedUser).map(u => (
                <option key={u.id} value={u.id}>{getUserLabel(u)}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text, #374151)' }}>
              Assignment Reason / Notes
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid var(--color-border, #d1d5db)',
                background: 'var(--color-surface, #ffffff)',
                fontSize: '0.875rem',
                color: 'var(--color-text, #111827)',
                minHeight: '80px',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical'
              }}
              placeholder="Add notes for the reviewer regarding this assignment..."
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
            {(approval.assigned_to || approval.assigned_to_name) && (
              <button 
                type="button" 
                onClick={handleUnassign} 
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-danger, #ef4444)',
                  background: 'transparent',
                  color: 'var(--color-danger, #ef4444)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  marginRight: 'auto'
                }}
              >
                Remove Assignment
              </button>
            )}
            <button 
              type="button" 
              onClick={onClose} 
              disabled={loading}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid var(--color-border, #d1d5db)',
                background: 'var(--color-surface, #ffffff)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                color: 'var(--color-text, #374151)'
              }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading || fetchingUsers || !selectedUser}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: 'var(--color-accent, #3b82f6)',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                opacity: (loading || fetchingUsers || !selectedUser) ? 0.6 : 1
              }}
            >
              {loading ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

