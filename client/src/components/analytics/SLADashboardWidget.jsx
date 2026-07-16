/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { DUMMY_SLA_DASHBOARD_DATA } from '../../data/dummyAnalyticsData';

const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

export default function SLADashboardWidget({ filters }) {

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    import('../../api/analytics').then(({ getSLADashboard }) => {
      getSLADashboard(filters)
        .then(resData => {
          if (!isMounted) return;
          if (!resData || !resData.status || resData.status.length === 0) {
            setData(DUMMY_SLA_DASHBOARD_DATA);
          } else {
            setData(resData);
          }
          setLoading(false);
        })
        .catch(err => {
          if (!isMounted) return;
          console.error('Failed to fetch SLA analytics:', err);
          setData(DUMMY_SLA_DASHBOARD_DATA);
          setLoading(false);
        });
    });

    return () => { isMounted = false; };
  }, [filters]);

  if (loading) return <div style={{ padding: '16px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>Loading...</div>;
  if (error) return <div style={{ padding: '16px', color: 'var(--color-danger)', textAlign: 'center' }}>{error}</div>;

  return (
    <div style={{ width: '100%', padding: '16px', display: 'flex' }}>
      <div style={{ flex: 1 }}>
        <ResponsiveContainer minWidth={1} minHeight={1} width="100%" height={280}>
          <PieChart>
            <Pie data={data.status} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
              {data.status.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: 'var(--color-surface-2)', border: 'none', borderRadius: '8px' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Avg Resolution</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{data.metrics?.avgResolution}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Breach Rate</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-danger)' }}>{data.metrics?.breachRate}</div>
        </div>
      </div>
    </div>
  );
}