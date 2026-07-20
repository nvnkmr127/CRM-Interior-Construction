import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import styles from './ConstructionSummary.module.css';

export default function ConstructionSummary({ approvalId, onValidationComplete }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get(`/financial-approvals/${approvalId}/construction-summary`);
        setData(res.data);
        
        // Pass validation state up so parent can lock approval button
        if (onValidationComplete) {
          const hasError = res.data.validationFlags?.some(f => f.type === 'error');
          onValidationComplete(hasError ? 'error' : 'safe');
        }
      } catch (err) {
        console.error('Failed to fetch construction summary');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [approvalId]);

  if (loading) return <div className={styles.loader}>Loading Construction Financials...</div>;
  if (!data || !data.projectId) return null;

  const formatMoney = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

  return (
    <div className={styles.container}>
      <h4 className={styles.title}>Project Financials & Compliance</h4>
      
      <div className={styles.grid}>
        <div className={styles.gridItem}>
          <span className={styles.label}>Total BOQ</span>
          <span className={styles.value}>{formatMoney(data.totalBoq)}</span>
        </div>
        <div className={styles.gridItem}>
          <span className={styles.label}>Issued POs</span>
          <span className={styles.value}>{formatMoney(data.totalPOs)}</span>
        </div>
        <div className={styles.gridItem}>
          <span className={styles.label}>Work Orders</span>
          <span className={styles.value}>{formatMoney(data.totalWOs)}</span>
        </div>
        <div className={styles.gridItem}>
          <span className={styles.label}>Site Expenses</span>
          <span className={styles.value}>{formatMoney(data.totalSiteExpenses)}</span>
        </div>
        <div className={styles.gridItem}>
          <span className={styles.label}>Client Milestones</span>
          <span className={styles.value}>{formatMoney(data.totalMilestones)}</span>
        </div>
        <div className={styles.gridItem}>
          <span className={styles.label}>Material Reqs</span>
          <span className={styles.value}>{formatMoney(data.totalMaterialRequests || 0)}</span>
        </div>
        <div className={styles.gridItem}>
          <span className={styles.label}>Advances</span>
          <span className={styles.value}>{formatMoney(data.totalAdvances || 0)}</span>
        </div>
      </div>

      {data.validationFlags && data.validationFlags.length > 0 && (
        <div className={styles.complianceBox}>
          <h5 className={styles.complianceTitle}>Tax & Retention Validation</h5>
          <ul className={styles.flagList}>
            {data.validationFlags.map((flag, idx) => (
              <li key={idx} className={`${styles.flagItem} ${styles[flag.type]}`}>
                {flag.type === 'error' && '❌ '}
                {flag.type === 'success' && '✅ '}
                {flag.type === 'warning' && '⚠️ '}
                {flag.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
