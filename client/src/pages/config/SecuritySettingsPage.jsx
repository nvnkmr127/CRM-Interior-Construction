import { useState, useEffect } from 'react';
import { PageHeader, Card, Button, Checkbox, Input } from '../../components/ui';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';

export default function SecuritySettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    mfa_required_all: false,
    session_timeout_minutes: 120,
    concurrent_login_limit: 3,
    password_min_length: 8,
    password_require_symbols: true,
    password_require_numbers: true,
    password_expiry_days: 90,
    password_prevent_reuse: 3,
    allowed_ips: [],
    allowed_countries: []
  });

  const [ipInput, setIpInput] = useState('');
  const [countryInput, setCountryInput] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/security/settings');
      if (data.success) {
        setSettings({
          ...data.data,
          allowed_ips: data.data.allowed_ips || [],
          allowed_countries: data.data.allowed_countries || []
        });
      }
    } catch (error) {
      toast.error('Failed to load security settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/security/settings', settings);
      toast.success('Security settings updated successfully');
    } catch (error) {
      toast.error('Failed to update security settings');
    } finally {
      setSaving(false);
    }
  };

  const addIp = () => {
    if (ipInput && !settings.allowed_ips.includes(ipInput)) {
      setSettings(prev => ({ ...prev, allowed_ips: [...prev.allowed_ips, ipInput] }));
      setIpInput('');
    }
  };

  const removeIp = (ip) => {
    setSettings(prev => ({ ...prev, allowed_ips: prev.allowed_ips.filter(i => i !== ip) }));
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <PageHeader 
        title="Enterprise Security" 
        subtitle="Manage authentication and access policies for all users in this workspace."
      />

      <Card title="Authentication & Session Policies">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Checkbox 
            label="Require Two-Factor Authentication (2FA) for all users"
            checked={settings.mfa_required_all}
            onChange={(e) => handleChange('mfa_required_all', e.target.checked)}
          />
          <Input 
            type="number"
            label="Session Timeout (Minutes)"
            value={settings.session_timeout_minutes}
            onChange={(e) => handleChange('session_timeout_minutes', parseInt(e.target.value))}
            min={15}
          />
          <Input 
            type="number"
            label="Concurrent Login Limit"
            value={settings.concurrent_login_limit}
            onChange={(e) => handleChange('concurrent_login_limit', parseInt(e.target.value))}
            min={0}
            helpText="Set to 0 for unlimited."
          />
        </div>
      </Card>

      <Card title="Password Policy">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Input 
              type="number"
              label="Minimum Length"
              value={settings.password_min_length}
              onChange={(e) => handleChange('password_min_length', parseInt(e.target.value))}
              min={6}
            />
            <Input 
              type="number"
              label="Expiry (Days)"
              value={settings.password_expiry_days}
              onChange={(e) => handleChange('password_expiry_days', parseInt(e.target.value))}
              min={0}
              helpText="0 to never expire."
            />
            <Input 
              type="number"
              label="Prevent Reuse (History)"
              value={settings.password_prevent_reuse}
              onChange={(e) => handleChange('password_prevent_reuse', parseInt(e.target.value))}
              min={0}
            />
          </div>
          <Checkbox 
            label="Require Symbols (!@#$%^&*)"
            checked={settings.password_require_symbols}
            onChange={(e) => handleChange('password_require_symbols', e.target.checked)}
          />
          <Checkbox 
            label="Require Numbers"
            checked={settings.password_require_numbers}
            onChange={(e) => handleChange('password_require_numbers', e.target.checked)}
          />
        </div>
      </Card>

      <Card title="Access Restrictions (Zero Trust)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>IP Allowlist</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <Input 
                placeholder="e.g. 192.168.1.1" 
                value={ipInput} 
                onChange={e => setIpInput(e.target.value)} 
              />
              <Button onClick={addIp}>Add IP</Button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {settings.allowed_ips.map(ip => (
                <div key={ip} style={{ padding: '4px 8px', background: 'var(--color-bg-secondary)', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {ip} <span style={{ cursor: 'pointer', color: 'var(--color-danger)' }} onClick={() => removeIp(ip)}>x</span>
                </div>
              ))}
              {settings.allowed_ips.length === 0 && <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>No IP restrictions (All allowed)</span>}
            </div>
          </div>
        </div>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
        <Button onClick={handleSave} loading={saving}>Save Security Settings</Button>
      </div>
    </div>
  );
}
