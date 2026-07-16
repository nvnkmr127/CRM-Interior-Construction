/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps, no-unused-vars */
import { useState, useEffect } from 'react';
import { getPaymentAgingReport } from '../../api/analytics';
import { Spinner, Badge, Button } from '../../components/ui';
import { useToast } from '../../store/toastContext';
import styles from './PaymentAgingReportPage.module.css';

export default function PaymentAgingReportPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ summary: {}, details: [] });
  const toast = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await getPaymentAgingReport();
      setData(res);
    } catch (err) {
      toast.addToast('Failed to load Payment Aging data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getBucketColor = (bucket) => {
    switch (bucket) {
      case '0-30 days': return 'success';
      case '31-60 days': return 'warning';
      case '61-90 days': return 'danger';
      case '90+ days': return 'danger';
      default: return 'neutral';
    }
  };

  if (loading) {
    return <div className={styles.loading}><Spinner /></div>;
  }

  const { summary, details } = data;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Payment Aging Report</h1>
          <div className={styles.desc}>
            Monitor outstanding payment milestones categorized by days overdue.
          </div>
        </div>
        <Button variant="outline" onClick={fetchData}>Refresh</Button>
      </div>

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>0-30 Days</span>
          <span className={styles.kpiValue}>
            ₹{summary['0-30 days']?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>31-60 Days</span>
          <span className={`${styles.kpiValue} ${styles.warning}`}>
            ₹{summary['31-60 days']?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>61-90 Days</span>
          <span className={`${styles.kpiValue} ${styles.danger}`}>
            ₹{summary['61-90 days']?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>90+ Days</span>
          <span className={`${styles.kpiValue} ${styles.danger}`}>
            ₹{summary['90+ days']?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
          </span>
        </div>
      </div>

      <div className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <h3>Outstanding Details</h3>
          <Badge variant="primary">{details.length} Records</Badge>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Client</th>
                <th>Project</th>
                <th>Milestone</th>
                <th>Due Date</th>
                <th>Days Overdue</th>
                <th>Bucket</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {details.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                    No outstanding payments found.
                  </td>
                </tr>
              ) : (
                details.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 500 }}>{row.client_name}</td>
                    <td>{row.project_name}</td>
                    <td>{row.milestone_name}</td>
                    <td>{new Date(row.due_date).toLocaleDateString()}</td>
                    <td>{row.days_overdue} days</td>
                    <td>
                      <Badge variant={getBucketColor(row.aging_bucket)}>
                        {row.aging_bucket}
                      </Badge>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      ₹{parseFloat(row.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
