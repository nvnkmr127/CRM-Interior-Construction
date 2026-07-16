import styles from '../DashboardPage.module.css';

export default function SalesManagerDashboard() {
  const teamData = [
    { id: 1, name: 'Rahul', revenue: '₹1.8Cr', leads: 84, conversion: '32%', sla: '96%', score: '⭐⭐⭐⭐⭐' },
    { id: 2, name: 'Kumar', revenue: '₹1.2Cr', leads: 73, conversion: '24%', sla: '82%', score: '⭐⭐⭐' },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.greeting}>Manager Dashboard</h1>
          <p className={styles.dateText}>Team Performance & Pipeline Health</p>
        </div>
      </div>

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Total Pipeline</div>
          <div className={styles.kpiValue}>₹8.4 Cr</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Expected Closures</div>
          <div className={styles.kpiValue}>₹2.3 Cr</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Leads At Risk</div>
          <div className={styles.kpiValue} style={{color: 'var(--color-danger)'}}>26</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Overdue Follow-ups</div>
          <div className={styles.kpiValue} style={{color: 'var(--color-warning)'}}>42</div>
        </div>
      </div>

      <div className={styles.midRow} style={{ gridTemplateColumns: '1fr' }}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>AI Insights</span>
          </div>
          <div className={styles.cardBody} style={{ padding: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
             <div style={{ flex: 1, minWidth: '200px', padding: '1rem', background: 'var(--color-surface-2)', borderRadius: '8px', borderLeft: '4px solid var(--color-danger)' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Team A has too many leads.</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Reassign 18 leads to Team B.</p>
             </div>
             <div style={{ flex: 1, minWidth: '200px', padding: '1rem', background: 'var(--color-surface-2)', borderRadius: '8px', borderLeft: '4px solid var(--color-success)' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Rahul closes luxury projects faster.</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Assign incoming premium customers to Rahul.</p>
             </div>
             <div style={{ flex: 1, minWidth: '200px', padding: '1rem', background: 'var(--color-surface-2)', borderRadius: '8px', borderLeft: '4px solid var(--color-warning)' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Team response time dropped.</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Review workload and availability.</p>
             </div>
          </div>
        </div>
      </div>

      <div className={styles.botRow} style={{ gridTemplateColumns: '1fr' }}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Team Performance</span>
          </div>
          <div className={styles.cardBody}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '1rem' }}>Salesperson</th>
                  <th style={{ padding: '1rem' }}>Revenue</th>
                  <th style={{ padding: '1rem' }}>Leads</th>
                  <th style={{ padding: '1rem' }}>Conversion</th>
                  <th style={{ padding: '1rem' }}>SLA</th>
                  <th style={{ padding: '1rem' }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {teamData.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border)', fontSize: '0.9rem' }}>
                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>{t.name}</td>
                    <td style={{ padding: '1rem' }}>{t.revenue}</td>
                    <td style={{ padding: '1rem' }}>{t.leads}</td>
                    <td style={{ padding: '1rem' }}>{t.conversion}</td>
                    <td style={{ padding: '1rem' }}>{t.sla}</td>
                    <td style={{ padding: '1rem' }}>{t.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
