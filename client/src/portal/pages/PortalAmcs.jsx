import React, { useState, useEffect, useMemo } from 'react';
import styles from './PortalAmcs.module.css';
import { getPortalAmcs } from '../../api/amcs';

export default function PortalAmcs() {
  const [amcs, setAmcs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPortalAmcs()
      .then(data => {
        setAmcs(data || []);
      })
      .catch(err => {
        console.error('Failed to fetch portal AMCs:', err);
        setAmcs([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const metrics = useMemo(() => {
    const stats = { active: 0, scheduled: 0, completed: 0 };
    amcs.forEach(a => {
      if (a.status === 'active') stats.active++;
      if (Array.isArray(a.visits)) {
        a.visits.forEach(v => {
          if (v.status === 'scheduled') stats.scheduled++;
          else if (v.status === 'completed') stats.completed++;
        });
      }
    });
    return stats;
  }, [amcs]);

  if (loading) {
    return <div className={styles.container}><div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-secondary)' }}>Loading your maintenance contracts...</div></div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.titleSection}>
        <h1 className={styles.title}>Annual Maintenance Contracts 🛠️</h1>
        <p className={styles.subtitle}>View your active post-warranty maintenance contract details, covered scopes, and scheduled service visits.</p>
      </div>

      {amcs.length > 0 ? (
        <>
          {/* Summary metrics strip */}
          <div className={styles.metricsRow}>
            <div className={styles.metricCard} style={{ borderLeft: '4px solid var(--color-success)' }}>
              <span className={styles.metricLabel}>Active Contracts</span>
              <span className={styles.metricValue} style={{ color: 'var(--color-success)' }}>{metrics.active}</span>
            </div>
            <div className={styles.metricCard} style={{ borderLeft: '4px solid var(--color-accent)' }}>
              <span className={styles.metricLabel}>Scheduled Visits</span>
              <span className={styles.metricValue} style={{ color: 'var(--color-accent)' }}>{metrics.scheduled}</span>
            </div>
            <div className={styles.metricCard} style={{ borderLeft: '4px solid var(--color-info, #0ea5e9)' }}>
              <span className={styles.metricLabel}>Completed Services</span>
              <span className={styles.metricValue} style={{ color: 'var(--color-info, #0ea5e9)' }}>{metrics.completed}</span>
            </div>
          </div>

          {/* AMC Contracts List */}
          <div className={styles.amcList}>
            {amcs.map(a => {
              const amcStatus = a.status;
              let badgeClass = styles.badgeActive;
              if (amcStatus === 'expired') badgeClass = styles.badgeExpired;
              else if (amcStatus === 'cancelled') badgeClass = styles.badgeCancelled;

              return (
                <div key={a.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div className={styles.contractInfo}>
                      <span className={styles.contractNumber}>Contract #{a.contract_number}</span>
                      <span className={`${styles.badge} ${badgeClass}`}>{amcStatus}</span>
                    </div>
                    <span className={styles.contractDates}>
                      Validity: {new Date(a.start_date).toLocaleDateString('en-IN')} to {new Date(a.end_date).toLocaleDateString('en-IN')}
                    </span>
                  </div>

                  <div>
                    <h4 className={styles.sectionTitle}>Covered Scope</h4>
                    <p className={styles.scopeText}>{a.covered_scope || 'General maintenance services.'}</p>
                  </div>

                  <div>
                    <h4 className={styles.sectionTitle}>Maintenance Visits Schedule</h4>
                    {a.visits && a.visits.length > 0 ? (
                      <div className={styles.visitsGrid}>
                        {a.visits.map((v, idx) => {
                          const isScheduled = v.status === 'scheduled';
                          const isCompleted = v.status === 'completed';

                          let vBadge = styles.badgeScheduled;
                          if (isCompleted) vBadge = styles.badgeCompleted;
                          else if (v.status === 'missed') vBadge = styles.badgeMissed;
                          else if (v.status === 'cancelled') vBadge = styles.badgeCancelled;

                          return (
                            <div key={v.id || idx} className={styles.visitCard}>
                              <div className={styles.visitHeader}>
                                <span className={styles.visitDate}>
                                  Date: {new Date(v.scheduled_date).toLocaleDateString('en-IN')}
                                </span>
                                <span className={`${styles.badge} ${vBadge}`}>{v.status}</span>
                              </div>

                              {isCompleted && v.completed_date && (
                                <span className={styles.completedDate}>
                                  ✓ Completed: {new Date(v.completed_date).toLocaleDateString('en-IN')}
                                </span>
                              )}

                              {v.remarks && (
                                <div className={styles.remarks}>
                                  <strong>Service Report: </strong> {v.remarks}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ padding: '16px', textAlign: 'center', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                        No maintenance visits scheduled. Please reach out to customer service to schedule your visits.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🛠️</div>
          <h2>No AMC contracts tracked</h2>
          <p>Maintenance contracts will appear here once you purchase or subscribe to an Annual Maintenance Contract package post-handover.</p>
        </div>
      )}
    </div>
  );
}
