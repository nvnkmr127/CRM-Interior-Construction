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
      const res = await api.get(\/api/financial-approvals/\/activity\);
      setLogs(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (f, l) => \\\\.toUpperCase();

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

  const renderDiff = (oldVal, newVal) => {
    if (!oldVal && !newVal) return null;
    let o = oldVal;
    let n = newVal;
    try { o = JSON.parse(oldVal); } catch(e){}
    try { n = JSON.parse(newVal); } catch(e){}

    return (
      <div style={{ marginTop: '8px', fontSize: '12px', background: 'var(--surface-sunken)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
        {o && <div><strong>Previous:</strong> <pre style={{ margin: 0 }}>{JSON.stringify(o, null, 2)}</pre></div>}
        {n && <div style={{ marginTop: '4px' }}><strong>New:</strong> <pre style={{ margin: 0 }}>{JSON.stringify(n, null, 2)}</pre></div>}
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
              <div className={styles.avatar} style={{ background: getActionColor(log.action), width: '32px', height: '32px' }}>
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
                  <span title=\IP Address\>?? {log.ip_address || 'Unknown IP'}</span>
                  <span title=\Browser\>?? {log.browser || 'Unknown Browser'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
