/* eslint-disable no-unused-vars */
import React from 'react';
import styles from './StatsBar.module.css';

export default function StatsBar({ data }) {
  if (!data) return <div className={styles.pulse}><div className={styles.skeletonCard}></div></div>;

  const formattedValue = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(data.pipeline_value_total || 0);

  const metrics = [
    { label: 'Total Leads', value: data.total_leads, subtext: `${data.new_this_period} new this period` },
    { label: 'Conversion Rate', value: `${data.conversion_rate}%`, subtext: 'Won / Total' },
    { label: 'Pipeline Value', value: formattedValue, subtext: 'Total budget max' },
    { label: 'Avg Days to Close', value: `${data.avg_time_to_close_days}d`, subtext: 'For won leads' }
  ];

  return (
    <div className={styles.grid}>
      {metrics.map((m, i) => (
        <div key={i} className={styles.card}>
          <p className={styles.label}>{m.label}</p>
          <h3 className={styles.value}>{m.value}</h3>
          <p className={styles.subtext}>{m.subtext}</p>
        </div>
      ))}
    </div>
  );
}
