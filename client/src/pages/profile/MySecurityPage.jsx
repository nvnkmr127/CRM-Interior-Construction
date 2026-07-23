import { useState, useEffect } from 'react';
import { PageHeader, Card, Button } from '../../components/ui';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';

export default function MySecurityPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [secret, setSecret] = useState('');
  const [otpCode, setOtpCode] = useState('');

  useEffect(() => {
    fetchMySecurity();
  }, []);

  const fetchMySecurity = async () => {
    try {
      const res = await api.get('/security/my-security');
      setData(res.data.data);
    } catch (error) {
      toast.error('Failed to load security profile');
    } finally {
      setLoading(false);
    }
  };

  const startMfaSetup = async () => {
    try {
      const res = await api.post('/security/my-security/setup-mfa');
      setQrCode(res.data.data.qrCodeDataUrl);
      setSecret(res.data.data.secret);
    } catch (error) {
      toast.error('Failed to start MFA setup');
    }
  };

  const confirmMfa = async () => {
    try {
      await api.post('/security/my-security/enable-mfa', { secret, token: otpCode });
      toast.success('Two-Factor Authentication Enabled');
      setQrCode(null);
      setSecret('');
      fetchMySecurity();
    } catch (error) {
      toast.error('Invalid verification code');
    }
  };

  const disableMfa = async () => {
    if (!window.confirm('Are you sure you want to disable Authenticator App 2FA? You will fall back to Email OTP.')) return;
    try {
      await api.post('/security/my-security/disable-mfa');
      toast.success('Two-Factor Authentication Disabled');
      fetchMySecurity();
    } catch (error) {
      toast.error('Failed to disable MFA');
    }
  };

  const revokeDevice = async (deviceId) => {
    try {
      await api.delete(`/security/my-security/devices/${deviceId}`);
      toast.success('Device revoked');
      fetchMySecurity();
    } catch (error) {
      toast.error('Failed to revoke device');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <PageHeader title="My Security" subtitle="Manage your password, two-factor authentication, and trusted devices." />

      <Card title="Two-Factor Authentication (2FA)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {data?.security?.mfa_enabled && data?.security?.mfa_method === 'totp' ? (
            <div>
              <p style={{ color: 'var(--color-success)', fontWeight: '500', marginBottom: '8px' }}>Authenticator App is Enabled</p>
              <Button variant="danger" onClick={disableMfa}>Disable Authenticator App</Button>
            </div>
          ) : (
            <div>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
                Secure your account with an Authenticator App (Google Authenticator, Authy, etc).
                Currently using Email Verification.
              </p>
              {!qrCode ? (
                <Button onClick={startMfaSetup}>Set Up Authenticator App</Button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--color-bg-secondary)', padding: '16px', borderRadius: '8px' }}>
                  <p>1. Scan this QR code with your Authenticator App</p>
                  <img src={qrCode} alt="QR Code" style={{ width: '150px', height: '150px' }} />
                  <p>2. Enter the 6-digit code from the app to verify</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      placeholder="000000" 
                      value={otpCode} 
                      onChange={e => setOtpCode(e.target.value)} 
                      style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', width: '100px' }}
                    />
                    <Button onClick={confirmMfa}>Verify</Button>
                    <Button variant="secondary" onClick={() => setQrCode(null)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card title="Trusted Devices">
        {data?.devices?.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>No trusted devices found.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '8px 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>Device</th>
                <th style={{ padding: '8px 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>Last Used</th>
                <th style={{ padding: '8px 0', fontSize: '13px', color: 'var(--color-text-secondary)' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {data?.devices?.map(dev => (
                <tr key={dev.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px 0', fontSize: '14px' }}>{dev.device_name}</td>
                  <td style={{ padding: '12px 0', fontSize: '14px', color: 'var(--color-text-secondary)' }}>{new Date(dev.last_used_at).toLocaleDateString()}</td>
                  <td style={{ padding: '12px 0' }}>
                    <Button variant="danger" size="small" onClick={() => revokeDevice(dev.id)}>Revoke</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
