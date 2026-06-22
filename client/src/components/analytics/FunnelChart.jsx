import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
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
          <p className={styles.tooltipTitle}>{stage ? stage.toString().replace(/_/g, ' ') : ''}</p>
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
        <ResponsiveContainer width="99%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ top: 20, right: 60, left: 20, bottom: 20 }}>
            <XAxis type="number" hide />
            <YAxis 
              dataKey="stage" 
              type="category" 
              axisLine={false} 
              tickLine={false} 
              tickFormatter={(v) => v ? v.toString().replace(/_/g, ' ') : ''} 
              width={160} 
              tick={{ fontSize: 13, textTransform: 'capitalize', fill: 'var(--text)' }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{fill: 'var(--color-bg-subtle, rgba(0,0,0,0.05))'}} />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={32}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={`var(--color-accent, hsl(270, 100%, ${55 + index * 8}%))`} />
              ))}
              <LabelList dataKey="count" position="right" fill="var(--text-h)" fontSize={13} fontWeight={600} offset={15} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
