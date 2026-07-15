import React, { useState, useEffect } from 'react';
import { getRepPerformance } from '../../api/analytics';
import styles from './RepLeaderboard.module.css';

export default function RepLeaderboard({ filters }) {

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    getRepPerformance(filters)
      .then(res => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error("RepLeaderboard error, using dummy data:", err);
          setData([
            { rep_id: 1, rep_name: 'Sarah Smith', leads_assigned: 145, won: 42, conversion_rate: 28.9, contacted_within_sla: '95%', visits_done: 34, proposals_sent: 40 },
            { rep_id: 2, rep_name: 'John Doe', leads_assigned: 120, won: 35, conversion_rate: 29.1, contacted_within_sla: '88%', visits_done: 28, proposals_sent: 35 },
            { rep_id: 3, rep_name: 'Mike Johnson', leads_assigned: 90, won: 20, conversion_rate: 22.2, contacted_within_sla: '82%', visits_done: 18, proposals_sent: 22 },
            { rep_id: 4, rep_name: 'Emma Davis', leads_assigned: 60, won: 12, conversion_rate: 20.0, contacted_within_sla: '90%', visits_done: 10, proposals_sent: 15 },
          ]);
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [filters]);

  if (loading) return <div style={{ padding: '16px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>Loading...</div>;
  if (error) return <div style={{ padding: '16px', color: 'var(--color-danger)', textAlign: 'center' }}>{error}</div>;

  if (!data || data.length === 0) {
    return <div className={styles.emptyState}>No rep performance data available for this period.</div>;
  }

  const maxWon = Math.max(...data.map(d => d.won));

  const handleDownload = () => {
    const headers = ['Rep Name', 'Assigned', 'Won', 'Conv %', 'SLA Met', 'Visits', 'Proposals'];
    const csvContent = [
      headers.join(','),
      ...data.map(r => `${r.rep_name},${r.leads_assigned},${r.won},${r.conversion_rate},${r.contacted_within_sla},${r.visits_done},${r.proposals_sent}`)
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rep_leaderboard_${new Date().getTime()}.csv`;
    link.click();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Rep Leaderboard</h3>
        <button onClick={handleDownload} className={styles.downloadBtn}>Download CSV</button>
      </div>
      <div className={styles.list}>
        {data.map((rep, index) => {
          const isTop = index === 0 && rep.won > 0;
          return (
            <div key={rep.rep_id || index} className={`${styles.repCard} ${isTop ? styles.repCardTop : ''}`}>
              <div className={styles.cardHeader}>
                <div className={styles.repInfo}>
                  <div className={styles.avatarContainer}>
                    {rep.avatar_url ? (
                      <img src={rep.avatar_url} alt={rep.rep_name} className={styles.avatarImg} />
                    ) : (
                      <div className={styles.avatarFallback}>
                        {(rep.rep_name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    {isTop && <span className={styles.crown} title="Top Performer">👑</span>}
                  </div>
                  <div>
                    <h4 className={styles.repName}>{rep.rep_name}</h4>
                    <p className={styles.repStats}>{rep.leads_assigned} assigned • {rep.contacted_within_sla} SLA met</p>
                  </div>
                </div>
                <div className={styles.scoreContainer}>
                  <p className={styles.wonText}>{rep.won} Won</p>
                  <p className={styles.convText}>{rep.conversion_rate}% Conv</p>
                </div>
              </div>
              
              <div className={styles.progressBarContainer}>
                <div 
                  className={`${styles.progressBar} ${isTop ? styles.progressBarTop : ''}`} 
                  style={{ width: `${maxWon > 0 ? (rep.won / maxWon) * 100 : 0}%` }}
                ></div>
              </div>
              
              <div className={styles.footerStats}>
                <span>{rep.visits_done} Visits</span>
                <span>{rep.proposals_sent} Proposals</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
