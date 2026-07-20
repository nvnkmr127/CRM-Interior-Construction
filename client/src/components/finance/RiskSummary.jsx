import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import styles from './RiskSummary.module.css';

export default function RiskSummary({ approvalId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRisk = async () => {
      try {
        const res = await api.get(`/financial-approvals/${approvalId}/risk-analysis`);
        setData(res.data);
      } catch (err) {
        console.error('Failed to fetch risk analysis');
      } finally {
        setLoading(false);
      }
    };
    fetchRisk();
  }, [approvalId]);

  if (loading) return <div className={styles.loader}>Analyzing Risk Factors...</div>;
  if (!data) return null;

  let badgeColor = '#10b981'; // low (green)
  let badgeText = 'Low Risk';
  if (data.badge === 'medium') {
    badgeColor = '#f59e0b';
    badgeText = 'Medium Risk';
  } else if (data.badge === 'high') {
    badgeColor = '#ef4444';
    badgeText = 'High Risk';
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>AI Risk Summary</span>
        <span className={styles.badge} style={{ backgroundColor: badgeColor }}>
          {badgeText} ({data.riskScore}/100)
        </span>
      </div>

      <div className={styles.reasonsBox}>
        <ul className={styles.reasonsList}>
          {data.reasons.map((reason, idx) => (
            <li key={idx} className={styles.reasonItem}>
              <span className={styles.bullet} style={{ backgroundColor: badgeColor }}></span>
              {reason}
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.recommendationBox} style={{ borderLeftColor: badgeColor }}>
        <strong>Recommendation:</strong> {data.recommendation}
      </div>
    </div>
  );
}
