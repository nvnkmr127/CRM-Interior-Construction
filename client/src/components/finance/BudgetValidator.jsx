import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import styles from './BudgetValidator.module.css';

export default function BudgetValidator({ approvalId, onValidationComplete }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBudget = async () => {
      try {
        const res = await api.get(`/financial-approvals/${approvalId}/budget-validation`);
        setData(res.data);
        if (onValidationComplete) onValidationComplete(res.data);
      } catch (err) {
        console.error('Failed to validate budget');
      } finally {
        setLoading(false);
      }
    };
    fetchBudget();
  }, [approvalId]);

  if (loading) return <div className={styles.loader}>Validating Project Budget...</div>;
  if (!data || !data.projectId) return null; // Hide if not linked to a project

  const formatMoney = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  
  const pctConsumed = Math.min(100, Math.max(0, (data.consumedBudget / data.totalBudget) * 100)) || 0;
  const pctRequest = Math.min(100, Math.max(0, (data.requestAmount / data.totalBudget) * 100)) || 0;

  let headerColor = '#059669'; // safe
  let headerText = 'Within Budget';
  let barColor = '#34d399';
  if (data.status === 'near_limit') {
    headerColor = '#d97706';
    headerText = 'Near Limit';
    barColor = '#fbbf24';
  } else if (data.status === 'exceeded') {
    headerColor = '#dc2626';
    headerText = 'Budget Exceeded';
    barColor = '#f87171';
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Project Budget Validation</span>
        <span className={styles.badge} style={{ backgroundColor: headerColor }}>{headerText}</span>
      </div>

      <div className={styles.progressContainer}>
        <div className={styles.progressBar}>
          <div className={styles.progressConsumed} style={{ width: `${pctConsumed}%` }}></div>
          <div className={styles.progressRequest} style={{ width: `${pctRequest}%`, backgroundColor: barColor }}></div>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.gridItem}>
          <div className={styles.label}>Approved Budget</div>
          <div className={styles.value}>{formatMoney(data.totalBudget)}</div>
        </div>
        <div className={styles.gridItem}>
          <div className={styles.label}>Consumed</div>
          <div className={styles.value}>{formatMoney(data.consumedBudget)}</div>
        </div>
        <div className={styles.gridItem}>
          <div className={styles.label}>Current Request</div>
          <div className={styles.value}>{formatMoney(data.requestAmount)}</div>
        </div>
        <div className={styles.gridItem}>
          <div className={styles.label} style={{ color: data.status === 'exceeded' ? '#dc2626' : 'inherit' }}>After Approval</div>
          <div className={styles.value} style={{ color: data.status === 'exceeded' ? '#dc2626' : 'inherit' }}>{formatMoney(data.afterApproval)}</div>
        </div>
      </div>
    </div>
  );
}
