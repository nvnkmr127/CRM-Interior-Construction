import React from 'react';
import styles from '../DashboardPage.module.css';

export default function CEODashboard() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.greeting}>CEO Dashboard</h1>
          <p className={styles.dateText}>Business Health & Revenue Forecast</p>
        </div>
      </div>

      <div className={styles.kpiGrid} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Revenue Pipeline</div>
          <div className={styles.kpiValue}>₹82 Cr</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Expected Monthly Revenue</div>
          <div className={styles.kpiValue}>₹6.8 Cr</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Bookings</div>
          <div className={styles.kpiValue}>₹2.9 Cr</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Revenue Forecast</div>
          <div className={styles.kpiValue} style={{color: 'var(--color-success)'}}>94%</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Growth</div>
          <div className={styles.kpiValue} style={{color: 'var(--color-success)'}}>18% ↑</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Lead Conversion</div>
          <div className={styles.kpiValue}>31%</div>
        </div>
      </div>

      <div className={styles.midRow} style={{ gridTemplateColumns: '1fr' }}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>AI Strategic Insights</span>
          </div>
          <div className={styles.cardBody} style={{ padding: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
             <div style={{ flex: 1, minWidth: '200px', padding: '1rem', background: 'var(--color-surface-2)', borderRadius: '8px', borderLeft: '4px solid var(--color-danger)' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Revenue likely to fall by 12% next month.</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Increase Google Ads budget to compensate.</p>
             </div>
             <div style={{ flex: 1, minWidth: '200px', padding: '1rem', background: 'var(--color-surface-2)', borderRadius: '8px', borderLeft: '4px solid var(--color-success)' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Builder referrals produce 42% higher revenue.</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Focus partnership efforts here.</p>
             </div>
             <div style={{ flex: 1, minWidth: '200px', padding: '1rem', background: 'var(--color-surface-2)', borderRadius: '8px', borderLeft: '4px solid var(--color-accent)' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Luxury projects growing faster.</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Expand premium sales team capacity.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
