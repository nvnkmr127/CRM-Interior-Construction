import { useState } from 'react';
import { Modal, Button, Input } from '../ui';
import api from '../../api/axios';

export default function ForcePasswordResetModal({ isOpen, userId, onReset, onCancel }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleReset = async () => {
    setError('');
    if (newPassword !== confirmPassword) {
      return setError('Passwords do not match');
    }

    setLoading(true);
    try {
      await api.post('/auth/force-reset-password', { userId, newPassword });
      onReset();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Password Expired">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
          Your password has expired in accordance with company security policy. Please choose a new password.
        </p>

        <Input
          label="New Password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        
        <Input
          label="Confirm New Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {error && <div style={{ color: 'var(--color-danger)', fontSize: '13px' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleReset} loading={loading} disabled={!newPassword || !confirmPassword}>
            Update Password
          </Button>
        </div>
      </div>
    </Modal>
  );
}
