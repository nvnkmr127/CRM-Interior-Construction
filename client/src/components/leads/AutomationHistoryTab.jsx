import React, { useEffect, useState } from 'react';
import { getAutomationEvents } from '../../api/leads';

const STATUS_CONFIG = {
  success: { color: '#10b981', bg: '#d1fae5', label: 'Success', icon: '✓' },
  failed:  { color: '#ef4444', bg: '#fee2e2', label: 'Failed',  icon: '✗' },
  skipped: { color: '#f59e0b', bg: '#fef3c7', label: 'Skipped', icon: '⊘' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { color: '#6b7280', bg: '#f3f4f6', label: status, icon: '?' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 10px', borderRadius: 9999, fontSize: 11,
      fontWeight: 600, color: cfg.color, backgroundColor: cfg.bg
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AutomationHistoryTab({ leadId }) {
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!leadId) return;
    setLoading(true);
    getAutomationEvents(leadId)
      .then(data => setEvents(data || []))
      .catch(() => setError('Failed to load automation history.'))
      .finally(() => setLoading(false));
  }, [leadId]);

  if (loading) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>⚙️</div>
      Loading automation history…
    </div>
  );

  if (error) return (
    <div style={{ padding: 24, color: '#ef4444', background: '#fee2e2', borderRadius: 8, fontSize: 13 }}>
      {error}
    </div>
  );

  if (events.length === 0) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
      <p style={{ fontWeight: 600, marginBottom: 4, color: '#374151' }}>No Automation History</p>
      <p style={{ fontSize: 13 }}>No automation workflows have been triggered for this lead yet.</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>Automation History</h3>
        <span style={{ fontSize: 12, color: '#6b7280' }}>{events.length} event{events.length !== 1 ? 's' : ''}</span>
      </div>

      {events.map(evt => (
        <div key={evt.id} style={{
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
          padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: '#1d4ed8',
                  background: '#eff6ff', padding: '2px 8px', borderRadius: 6
                }}>
                  {evt.workflow || 'Unknown Workflow'}
                </span>
                <StatusBadge status={evt.status} />
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {evt.trigger_type && (
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    <strong style={{ color: '#374151' }}>Trigger:</strong> {evt.trigger_type}
                  </span>
                )}
                {evt.action_type && (
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    <strong style={{ color: '#374151' }}>Action:</strong> {evt.action_type}
                  </span>
                )}
                {evt.duration_ms != null && (
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    <strong style={{ color: '#374151' }}>Duration:</strong> {evt.duration_ms}ms
                  </span>
                )}
              </div>
              {evt.error_message && (
                <div style={{
                  marginTop: 8, padding: '6px 10px', background: '#fef2f2',
                  border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#dc2626'
                }}>
                  ⚠ {evt.error_message}
                </div>
              )}
            </div>
            <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {formatDate(evt.executed_at)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
