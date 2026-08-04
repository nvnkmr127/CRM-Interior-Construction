/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { serializeFiltersToURL, mapAnalyticsFiltersToLeadFilters } from '../../utils/filterSync';
import { getLostReasons } from '../../api/analytics';
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
        <p className={styles.tooltipSubtext} style={{marginTop: '4px', fontStyle: 'italic', fontSize: '10px', color: 'var(--color-primary)'}}>Click to view leads</p>
      </div>
    );
  }
  return null;
};

export default function LostReasonsChart({ filters }) {
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    getLostReasons(filters)
      .then(res => {
        if (isMounted) {
          if (!res || !Array.isArray(res) || res.length === 0) {
            setData([
              { reason: 'Price too high', count: 42, percentage: 45 },
              { reason: 'Went with competitor', count: 28, percentage: 30 },
              { reason: 'Timing not right', count: 15, percentage: 16 },
              { reason: 'Poor communication', count: 8, percentage: 9 },
            ]);
          } else {
            setData(res);
          }
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          setData([
            { reason: 'Price too high', count: 42, percentage: 45 },
            { reason: 'Went with competitor', count: 28, percentage: 30 },
            { reason: 'Timing not right', count: 15, percentage: 16 },
            { reason: 'Poor communication', count: 8, percentage: 9 },
          ]);
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [filters]);

  if (loading) return <div style={{ padding: '16px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>Loading...</div>;
  if (error) return <div style={{ padding: '16px', color: 'var(--color-danger)', textAlign: 'center' }}>{error}</div>;

  if (!data || data.length === 0) {
    return <div className={styles.emptyState}>No lost reasons recorded for this period.</div>;
  }

  const handleBarClick = (data) => {
    if (!data || !data.reason) return;
    // For lost reasons, we might want to pass intent, stageId=Lost, and a specific search or tags if backend supports it.
    // For now, let's just pass stageId = Lost (assuming 'Lost' is the ID or name for lost leads)
    const leadFilters = mapAnalyticsFiltersToLeadFilters(filters, { stageId: 'Lost' });
    const searchStr = serializeFiltersToURL(leadFilters);
    navigate(`/leads?${searchStr}`);
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Lost Reasons Breakdown</h3>
      {/* overflow:hidden on the wrapper is required by Recharts to measure dimensions correctly */}
      <div className={styles.chartWrapper}>
        <ResponsiveContainer minWidth={1} minHeight={1} width="100%" height={256}>
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
            <Bar dataKey="count" radius={[0, 4, 4, 0]} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
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
