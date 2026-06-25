import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import styles from './LostReasonsChart.module.css';

// Defined outside component to avoid re-creation on every render (Recharts tooltip gotcha)
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const { reason, count, percentage } = payload[0].payload;
    return (
      <div className={styles.tooltip}>
        <p className={styles.tooltipTitle}>{reason.replace(/_/g, ' ')}</p>
        <p className={styles.tooltipText}>Count: {count}</p>
        <p className={styles.tooltipSubtext}>{percentage}% of lost leads</p>
      </div>
    );
  }
  return null;
};

export default function LostReasonsChart({ data }) {
  if (!data || data.length === 0) {
    return <div className={styles.emptyState}>No lost reasons recorded for this period.</div>;
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Lost Reasons Breakdown</h3>
      {/* overflow:hidden on the wrapper is required by Recharts to measure dimensions correctly */}
      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height={256}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <XAxis type="number" hide />
            <YAxis
              dataKey="reason"
              type="category"
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v.replace(/_/g, ' ')}
              width={100}
              style={{ fontSize: '12px', textTransform: 'capitalize' }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
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
