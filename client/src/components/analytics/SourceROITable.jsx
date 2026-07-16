/* eslint-disable no-unused-vars */
import React from 'react';
import styles from './SourceROITable.module.css';

export default function SourceROITable({ data }) {
  if (!data || data.length === 0) {
    return <div className={styles.emptyState}>No source data available for this period.</div>;
  }

  const handleDownload = () => {
    const headers = ['Source', 'Total Leads', 'Won Leads', 'Conversion %', 'Total Value'];
    const csvContent = [
      headers.join(','),
      ...data.map(r => `${r.source || 'Unknown'},${r.count},${r.won_count},${r.conversion_rate},${r.total_value}`)
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `source_roi_${new Date().getTime()}.csv`;
    link.click();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Source ROI</h3>
        <button onClick={handleDownload} className={styles.downloadBtn}>Download CSV</button>
      </div>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th className={styles.th}>Source</th>
              <th className={`${styles.th} ${styles.thRight}`}>Leads</th>
              <th className={`${styles.th} ${styles.thRight}`}>Won</th>
              <th className={`${styles.th} ${styles.thRight}`}>Conv %</th>
              <th className={`${styles.th} ${styles.thRight}`}>Pipeline Value</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className={styles.tr}>
                <td className={`${styles.td} ${styles.tdSource}`}>{row.source?.replace('_', ' ') || 'Unknown'}</td>
                <td className={`${styles.td} ${styles.tdRight}`}>{row.count}</td>
                <td className={`${styles.td} ${styles.tdRight} ${styles.tdSuccess}`}>{row.won_count}</td>
                <td className={`${styles.td} ${styles.tdRight}`}>{row.conversion_rate}%</td>
                <td className={`${styles.td} ${styles.tdRight}`}>
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(row.total_value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
