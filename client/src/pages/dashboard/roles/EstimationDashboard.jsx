import styles from '../DashboardPage.module.css';

export default function EstimationDashboard() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.greeting}>Estimation Dashboard</h1>
          <p className={styles.dateText}>Quotations & Margin Analysis</p>
        </div>
      </div>

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Pending Estimates</div>
          <div className={styles.kpiValue}>18</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Average Estimate Time</div>
          <div className={styles.kpiValue}>1.8 days</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Average Margin</div>
          <div className={styles.kpiValue} style={{color: 'var(--color-success)'}}>22%</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Revision Count</div>
          <div className={styles.kpiValue} style={{color: 'var(--color-warning)'}}>2.4 avg</div>
        </div>
      </div>

      <div className={styles.midRow} style={{ gridTemplateColumns: '1fr' }}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>AI Estimation Assistant</span>
          </div>
          <div className={styles.cardBody} style={{ padding: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
             <div style={{ flex: 1, minWidth: '200px', padding: '1rem', background: 'var(--color-surface-2)', borderRadius: '8px', borderLeft: '4px solid var(--color-warning)' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Pricing anomaly detected.</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Italian marble cost for 'Project B' is 15% below current market rates. Update catalog.</p>
             </div>
             <div style={{ flex: 1, minWidth: '200px', padding: '1rem', background: 'var(--color-surface-2)', borderRadius: '8px', borderLeft: '4px solid var(--color-success)' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Suggest Material Alternatives.</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Client budget is tight. Suggest premium engineered wood instead of solid teak to maintain margin.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
