import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import styles from './ApprovalComments.module.css';

export default function ActivityLogTimeline({ approvalId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [approvalId]);

  const fetchLogs = async () => {
    try {
      const res = await api.get(`/financial-approvals/${approvalId}/activity`);
      const data = res.data?.data;
      setLogs(Array.isArray(data) ? data : (Array.isArray(res.data) ? res.data : []));
    } catch (e) {
      console.error(e);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (f, l) => `${f ? f[0] : ''}${l ? l[0] : ''}`.toUpperCase();

  const getActionColor = (action) => {
    switch(action) {
      case 'Approved': return 'green';
      case 'Rejected': return 'red';
      case 'Commented': return '#3b82f6';
      case 'Reopened': return '#f59e0b';
      case 'Created': return '#8b5cf6';
      case 'Edited': return '#eab308';
      case 'Assigned': return '#ec4899';
      case 'Opened': return '#6366f1';
      case 'Exported':
      case 'Downloaded': return '#06b6d4';
      default: return '#6b7280';
    }
  };

  const formatValue = (val) => {
    if (val === null || val === undefined) return null;
    let data = val;
    if (typeof val === 'string') {
      try { data = JSON.parse(val); } catch(e) { return <span>{val}</span>; }
    }
    if (typeof data !== 'object' || data === null) {
      return <span>{String(data)}</span>;
    }

    // Clean formatting for audit objects
    const formatKey = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    const renderObjectFields = (obj) => {
      if (typeof obj !== 'object' || obj === null) return String(obj);
      return Object.entries(obj).map(([k, v]) => {
        // Skip technical internal IDs from raw display
        if (['id', 'tenant_id', 'requested_by', 'target_id'].includes(k)) return null;

        let displayVal = v;
        if (k === 'amount' || k === 'paid_amount') {
          displayVal = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v);
        } else if (typeof v === 'object' && v !== null) {
          displayVal = JSON.stringify(v);
        }

        return (
          <div key={k} style={{ display: 'flex', gap: '8px', padding: '3px 0', borderBottom: '1px dashed var(--color-border-light, rgba(0,0,0,0.05))' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)', minWidth: '110px' }}>{formatKey(k)}:</span>
            <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{String(displayVal)}</span>
          </div>
        );
      });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
        {renderObjectFields(data)}
      </div>
    );
  };

  const renderDiff = (oldVal, newVal) => {
    if (!oldVal && !newVal) return null;

    return (
      <div style={{ marginTop: '8px', fontSize: '12px', background: 'var(--color-surface-2, rgba(0,0,0,0.02))', padding: '10px 12px', borderRadius: 'var(--radius-md, 6px)', border: '1px solid var(--color-border)' }}>
        {oldVal && (
          <div style={{ marginBottom: '8px' }}>
            <span style={{ fontWeight: 700, color: 'var(--color-danger, #ef4444)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Previous Details</span>
            {formatValue(oldVal)}
          </div>
        )}
        {newVal && (
          <div>
            <span style={{ fontWeight: 700, color: 'var(--color-success, #10b981)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Request Details</span>
            {formatValue(newVal)}
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading activity...</div>;

  return (
    <div className={styles.container} style={{ height: '500px', overflowY: 'auto', padding: '16px' }}>
      {logs.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No activity found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '15px', top: '0', bottom: '0', width: '2px', background: 'var(--border-color)' }}></div>
          {logs.map((log, i) => (
            <div key={log.id} style={{ display: 'flex', gap: '12px', position: 'relative', zIndex: 1 }}>
              <div className={styles.avatar} style={{ background: getActionColor(log.action), width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', borderRadius: '50%' }}>
                {getInitials(log.first_name, log.last_name)}
              </div>
              <div style={{ flex: 1, background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <strong>{log.first_name} {log.last_name} ({log.role})</strong>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{new Date(log.created_at).toLocaleString()}</span>
                </div>
                <div>
                  <span style={{ fontWeight: '600', color: getActionColor(log.action) }}>{log.action}</span>
                </div>
                {renderDiff(log.old_value, log.new_value)}
                <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', gap: '8px' }}>
                  <span title="IP Address">🌐 {log.ip_address || 'Unknown IP'}</span>
                  <span title="Browser">🖥️ {log.browser || 'Unknown Browser'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
