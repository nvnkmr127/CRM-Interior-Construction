import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import styles from './LostReasonsChart.module.css';

export default function LostReasonsChart({ data }) {
  if (!data || data.length === 0) {
    return <div className={styles.emptyState}>No lost reasons recorded for this period.</div>;
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const { reason, count, percentage } = payload[0].payload;
      return (
        <div className={styles.tooltip}>
          <p className={styles.tooltipTitle}>{reason.replace('_', ' ')}</p>
          <p className={styles.tooltipText}>Count: {count}</p>
          <p className={styles.tooltipSubtext}>{percentage}% of lost leads</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Lost Reasons Breakdown</h3>
      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <XAxis type="number" hide />
            <YAxis dataKey="reason" type="category" axisLine={false} tickLine={false} tickFormatter={(v) => v.replace('_', ' ')} width={100} style={{ fontSize: '12px', textTransform: 'capitalize' }} />
            <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="var(--color-danger, #f87171)" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
