import React, { useState, useEffect } from 'react';
import { PageHeader, Card, Button, Checkbox, Input } from '../../components/ui';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';

export default function NotificationPreferencesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [prefs, setPrefs] = useState({
    email_sla_breaches: true,
    push_score_changes: true,
    dnd_start_time: '22:00',
    dnd_end_time: '08:00'
  });

  useEffect(() => {
    fetchPrefs();
  }, []);

  const fetchPrefs = async () => {
    try {
      const res = await api.get('/notifications/preferences');
      if (res.data?.data) {
        setPrefs({
          email_sla_breaches: res.data.data.email_sla_breaches ?? true,
          push_score_changes: res.data.data.push_score_changes ?? true,
          dnd_start_time: res.data.data.dnd_start_time || '22:00',
          dnd_end_time: res.data.data.dnd_end_time || '08:00'
        });
      }
    } catch (err) {
      toast.error('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/notifications/preferences', prefs);
      toast.success('Preferences saved successfully');
    } catch (err) {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key, value) => {
    setPrefs(p => ({ ...p, [key]: value }));
  };

  if (loading) return <div style={{ padding: '24px' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      <PageHeader 
        title="Notification Preferences" 
        description="Manage how and when you receive notifications across the platform."
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <Card title="Delivery Channels">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Checkbox 
              label="In-App Notifications & Alerts (Cannot be disabled)" 
              checked={true} 
              disabled={true} 
            />
            <Checkbox 
              label="Email Notifications (e.g., SLA Breaches, Weekly Summaries)" 
              checked={prefs.email_sla_breaches} 
              onChange={(e) => handleChange('email_sla_breaches', e.target.checked)} 
            />
            <Checkbox 
              label="Browser Push Notifications" 
              checked={prefs.push_score_changes} 
              onChange={(e) => handleChange('push_score_changes', e.target.checked)} 
            />
          </div>
        </Card>

        <Card title="Do Not Disturb Window">
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
            Notifications triggered during this window will be silently delivered to your inbox without push alerts or emails.
          </p>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <Input 
                type="time" 
                label="Start Time" 
                value={prefs.dnd_start_time} 
                onChange={(e) => handleChange('dnd_start_time', e.target.value)} 
              />
            </div>
            <div style={{ flex: 1 }}>
              <Input 
                type="time" 
                label="End Time" 
                value={prefs.dnd_end_time} 
                onChange={(e) => handleChange('dnd_end_time', e.target.value)} 
              />
            </div>
          </div>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="primary" onClick={handleSave} isLoading={saving}>Save Preferences</Button>
        </div>
      </div>
    </div>
  );
}
