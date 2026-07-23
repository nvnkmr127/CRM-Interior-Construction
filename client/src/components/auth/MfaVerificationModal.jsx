import { useState } from 'react';
import { Modal, Button, Input, Checkbox } from '../ui';
import api from '../../api/axios';

export default function MfaVerificationModal({ isOpen, mfaMethod, tempToken, onVerified, onCancel }) {
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleVerify = async () => {
    setError('');
    setLoading(true);
    try {
      // The tempToken should be sent as the Authorization header
      const response = await api.post('/auth/verify-mfa', { code, trustDevice }, {
        headers: { Authorization: `Bearer ${tempToken}` }
      });
      onVerified(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Two-Step Verification">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
          {mfaMethod === 'totp' 
            ? "Enter the 6-digit code from your Authenticator app." 
            : "We've sent a 6-digit verification code to your email."}
        </p>

        <Input
          label="Verification Code"
          type="text"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="000000"
          autoFocus
        />

        <Checkbox
          label="Trust this device for 30 days"
          checked={trustDevice}
          onChange={(e) => setTrustDevice(e.target.checked)}
        />

        {error && <div style={{ color: 'var(--color-danger)', fontSize: '13px' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleVerify} loading={loading} disabled={code.length < 6}>
            Verify
          </Button>
        </div>
      </div>
    </Modal>
  );
}
