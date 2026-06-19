import React from 'react';
import styles from '../DashboardPage.module.css';

export default function MarketingDashboard() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.greeting}>Marketing Dashboard</h1>
          <p className={styles.dateText}>Lead Generation Quality & ROI</p>
        </div>
      </div>

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Cost Per Lead (CPL)</div>
          <div className={styles.kpiValue}>₹850</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>MQL to SQL %</div>
          <div className={styles.kpiValue}>28%</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>SQL to Booking %</div>
          <div className={styles.kpiValue}>14%</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>ROAS</div>
          <div className={styles.kpiValue} style={{color: 'var(--color-success)'}}>4.2x</div>
        </div>
      </div>

      <div className={styles.midRow} style={{ gridTemplateColumns: '1fr' }}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>AI Marketing Insights</span>
          </div>
          <div className={styles.cardBody} style={{ padding: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
             <div style={{ flex: 1, minWidth: '200px', padding: '1rem', background: 'var(--color-surface-2)', borderRadius: '8px', borderLeft: '4px solid var(--color-success)' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Instagram generates more premium leads.</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Luxury project conversions from IG are up 15% this month.</p>
             </div>
             <div style={{ flex: 1, minWidth: '200px', padding: '1rem', background: 'var(--color-surface-2)', borderRadius: '8px', borderLeft: '4px solid var(--color-accent)' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Google Ads produce higher overall conversion.</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Recommend shifting 20% budget from Facebook to Google Search.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
