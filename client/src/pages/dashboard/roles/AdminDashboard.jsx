import React from 'react';
import styles from '../DashboardPage.module.css';

export default function AdminDashboard() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.greeting}>Admin Dashboard</h1>
          <p className={styles.dateText}>System Health & Governance</p>
        </div>
      </div>

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Active Users</div>
          <div className={styles.kpiValue}>48</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Automation Status</div>
          <div className={styles.kpiValue} style={{color: 'var(--color-success)'}}>Healthy</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>API Health</div>
          <div className={styles.kpiValue} style={{color: 'var(--color-success)'}}>99.9%</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Failed Integrations</div>
          <div className={styles.kpiValue} style={{color: 'var(--color-danger)'}}>2</div>
        </div>
      </div>

      <div className={styles.midRow} style={{ gridTemplateColumns: '1fr' }}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>System Alerts</span>
          </div>
          <div className={styles.cardBody} style={{ padding: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
             <div style={{ flex: 1, minWidth: '200px', padding: '1rem', background: 'var(--color-surface-2)', borderRadius: '8px', borderLeft: '4px solid var(--color-danger)' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>WhatsApp API Integration failed.</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Check Meta Developer Console for token expiration.</p>
             </div>
             <div style={{ flex: 1, minWidth: '200px', padding: '1rem', background: 'var(--color-surface-2)', borderRadius: '8px', borderLeft: '4px solid var(--color-warning)' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Storage Usage High</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Project documents are taking up 85% of allocated S3 bucket limits. Consider upgrading tier.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
