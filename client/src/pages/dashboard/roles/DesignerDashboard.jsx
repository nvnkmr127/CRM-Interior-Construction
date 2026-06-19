import React from 'react';
import styles from '../DashboardPage.module.css';

export default function DesignerDashboard() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.greeting}>Designer Dashboard</h1>
          <p className={styles.dateText}>Design Activities & Approvals</p>
        </div>
      </div>

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Projects Assigned</div>
          <div className={styles.kpiValue}>12</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Pending Presentations</div>
          <div className={styles.kpiValue}>4</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Revision Requests</div>
          <div className={styles.kpiValue} style={{color: 'var(--color-warning)'}}>3</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Designs Approved</div>
          <div className={styles.kpiValue} style={{color: 'var(--color-success)'}}>8</div>
        </div>
      </div>

      <div className={styles.midRow} style={{ gridTemplateColumns: '1fr' }}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>AI Design Assistant</span>
          </div>
          <div className={styles.cardBody} style={{ padding: '1.5rem' }}>
            <div style={{ padding: '1rem', background: 'var(--color-surface-2)', borderRadius: '8px', borderLeft: '4px solid #8B5CF6' }}>
               <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Customer (Sharma Residence) prefers Scandinavian interiors.</p>
               <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Tip: Use previous project references like 'Project Zenith' to accelerate the pitch.</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className={styles.botRow}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Today's Meetings</span>
          </div>
          <div className={styles.cardBody} style={{ padding: '1rem' }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>10:00 AM - Material Selection (Gupta)</li>
              <li style={{ padding: '0.5rem 0' }}>02:00 PM - Initial Concept Presentation (Reddy)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
