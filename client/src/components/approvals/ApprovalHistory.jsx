import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Skeleton } from '../ui';
import styles from './ApprovalHistory.module.css';

export default function ApprovalHistory({ module, id }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!module || !id) return;
    
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/approvals/${module}/${id}/history`);
        if (res.data?.success) {
          setHistory(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch approval history', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [module, id]);

  if (loading) {
    return <Skeleton height="150px" />;
  }

  if (history.length === 0) {
    return <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>No approval history available.</div>;
  }

  return (
    <div className={styles.timeline}>
      {history.map((log) => {
        let icon = '📝';
        if (log.action === 'approved') icon = '✅';
        else if (log.action === 'rejected') icon = '❌';
        else if (log.action === 'pending' || log.action === 'requested') icon = '⏳';

        return (
          <div key={log.id} className={styles.timelineItem}>
            <div className={styles.timelineIcon}>{icon}</div>
            <div className={styles.timelineContent}>
              <div className={styles.timelineHeader}>
                <strong>{log.actor_name || 'System'}</strong> 
                <span className={styles.actionText}>
                  {log.action === 'pending' ? 'requested approval' : `marked as ${log.action}`}
                </span>
                <span className={styles.timelineDate}>
                  {new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
              {log.comments && (
                <div className={styles.timelineComment}>
                  "{log.comments}"
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
