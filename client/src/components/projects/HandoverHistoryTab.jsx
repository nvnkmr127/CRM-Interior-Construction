import { useState, useEffect } from 'react';
import { getProjectHandovers } from '../../api/projects';

export default function HandoverHistoryTab({ projectId }) {
  const [handovers, setHandovers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    getProjectHandovers(projectId)
      .then(res => {
        const data = res.data?.data || res.data || [];
        setHandovers(Array.isArray(data) ? data : []);
      })
      .catch(err => console.error('Failed to fetch project handovers', err))
      .finally(() => setLoading(false));
  }, [projectId]);

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
        Loading handover logs...
      </div>
    );
  }

  if (handovers.length === 0) {
    return (
      <div style={{
        padding: '40px 20px',
        border: '1px dashed var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        textAlign: 'center',
        background: 'var(--color-surface)',
        color: 'var(--color-text-muted)',
        fontSize: 'var(--text-sm)'
      }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
        <strong>No Resource Handovers Recorded</strong>
        <p style={{ marginTop: '8px', color: 'var(--color-text-secondary)', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
          This project has maintained its original Project Manager and Designer assignments since initiation.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
        Chronological log of PM and Designer replacements and knowledge handovers.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {handovers.map((h) => {
          const isPm = h.role === 'pm';
          return (
            <div
              key={h.id}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                cursor: 'default'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    textTransform: 'uppercase',
                    background: isPm ? 'var(--color-primary-bg, #e0f2fe)' : 'var(--color-accent-bg, #eff6ff)',
                    color: isPm ? 'var(--color-primary, #0284c7)' : 'var(--color-accent, #3b82f6)'
                  }}>
                    {isPm ? 'Project Manager' : 'Designer'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{h.replaced_user_name || 'Outgoing'}</span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>➔</span>
                    <span style={{ color: 'var(--color-success, #22c55e)' }}>{h.assigned_user_name || 'Incoming'}</span>
                  </div>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  {formatDate(h.created_at)}
                </div>
              </div>

              <div style={{
                background: 'var(--color-surface-hover, #f8fafc)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                fontSize: 'var(--text-sm)',
                lineHeight: 1.6,
                color: 'var(--color-text)',
                whiteSpace: 'pre-wrap',
                fontStyle: 'italic'
              }}>
                "{h.handover_notes}"
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                <span>Handover recorded by</span>
                <strong style={{ color: 'var(--color-text-secondary)' }}>{h.creator_name || 'System'}</strong>
                <span>• Client and incoming assignee notified successfully</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
