import styles from '../DashboardPage.module.css';

export default function CustomerSuccessDashboard() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.greeting}>Customer Success Dashboard</h1>
          <p className={styles.dateText}>Post-Booking Experience</p>
        </div>
      </div>

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Net Promoter Score (NPS)</div>
          <div className={styles.kpiValue} style={{color: 'var(--color-success)'}}>72</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Customer Rating</div>
          <div className={styles.kpiValue}>4.8/5</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Open Issues</div>
          <div className={styles.kpiValue} style={{color: 'var(--color-warning)'}}>11</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Referral Rate</div>
          <div className={styles.kpiValue} style={{color: 'var(--color-success)'}}>18%</div>
        </div>
      </div>

      <div className={styles.midRow} style={{ gridTemplateColumns: '1fr' }}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>AI Sentiment Predictor</span>
          </div>
          <div className={styles.cardBody} style={{ padding: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
             <div style={{ flex: 1, minWidth: '200px', padding: '1rem', background: 'var(--color-surface-2)', borderRadius: '8px', borderLeft: '4px solid var(--color-danger)' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Customer (Aman) expressing frustration on WhatsApp.</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Recommend immediate phone intervention to clarify timeline delay.</p>
             </div>
             <div style={{ flex: 1, minWidth: '200px', padding: '1rem', background: 'var(--color-surface-2)', borderRadius: '8px', borderLeft: '4px solid var(--color-success)' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Handover completed for 'Project X'.</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>High satisfaction predicted. Send referral request.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
