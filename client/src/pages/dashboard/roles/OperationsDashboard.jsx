import React from 'react';
import styles from '../DashboardPage.module.css';

export default function OperationsDashboard() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.greeting}>Operations Dashboard</h1>
          <p className={styles.dateText}>Project Handoffs & Execution Readiness</p>
        </div>
      </div>

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Projects Awaiting Kickoff</div>
          <div className={styles.kpiValue}>7</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Average Handover Time</div>
          <div className={styles.kpiValue}>2.4 days</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Pending Documents</div>
          <div className={styles.kpiValue} style={{color: 'var(--color-warning)'}}>15</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Project Start Delay</div>
          <div className={styles.kpiValue} style={{color: 'var(--color-danger)'}}>2</div>
        </div>
      </div>

      <div className={styles.midRow} style={{ gridTemplateColumns: '1fr' }}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>AI Risk Predictor</span>
          </div>
          <div className={styles.cardBody} style={{ padding: '1.5rem' }}>
            <div style={{ padding: '1rem', background: 'var(--color-surface-2)', borderRadius: '8px', borderLeft: '4px solid var(--color-danger)' }}>
               <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Predicting a 5-day delay for 'Villa 21, Palm Meadows'.</p>
               <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Reason: Critical plumbing layout documents are missing from the handoff package.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
