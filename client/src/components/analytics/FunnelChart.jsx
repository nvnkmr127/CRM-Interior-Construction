import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import styles from './FunnelChart.module.css';

export default function FunnelChart({ data }) {
  if (!data || data.length === 0) {
    return <div className={styles.emptyState}>No funnel data available for this period.</div>;
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const { stage, count, drop_off_rate } = payload[0].payload;
      return (
        <div className={styles.tooltip}>
          <p className={styles.tooltipTitle}>{stage.replace('_', ' ')}</p>
          <p className={styles.tooltipText}>Leads: {count}</p>
          {drop_off_rate > 0 && <p className={styles.tooltipDanger}>Drop-off: {drop_off_rate}%</p>}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Pipeline Funnel</h3>
      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <XAxis type="number" hide />
            <YAxis dataKey="stage" type="category" axisLine={false} tickLine={false} tickFormatter={(v) => v.replace('_', ' ')} width={100} style={{ fontSize: '12px', textTransform: 'capitalize' }} />
            <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={`var(--color-accent, hsl(270, 100%, ${60 + index * 5}%))`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
