import { useState, useEffect } from 'react';
import api from '../../api/axios';
import styles from './AIInsightsPanel.module.css';

export default function AIInsightsPanel() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.get('/users/ai/insights')
      .then(res => {
        if (mounted) {
          setInsights(res.data?.data?.anomalies || []);
          setLoading(false);
        }
      })
      .catch(err => {
        if (mounted) {
          setInsights([]);
          setLoading(false);
        }
      });
    return () => mounted = false;
  }, []);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.skeletonPulse}>✨ AI analyzing directory...</div>
      </div>
    );
  }

  if (!insights || insights.length === 0) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.sparkle}>✨</span> 
        <strong>AI Directory Insights</strong>
      </div>
      <div className={styles.insightsList}>
        {insights.map((insight, idx) => (
          <div key={idx} className={`${styles.insightCard} ${styles[insight.severity || 'low']}`}>
            <div className={styles.insightType}>
              {insight.type === 'duplicate' ? '👥 Duplicate Risk' : 
               insight.type === 'inactive' ? '💤 Inactive Account' : 
               '🛡️ Security Notice'}
            </div>
            <div className={styles.insightMessage}>{insight.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
