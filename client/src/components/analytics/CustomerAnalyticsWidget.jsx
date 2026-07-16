/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { DUMMY_CUSTOMER_DATA } from '../../data/dummyAnalyticsData';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function CustomerAnalyticsWidget({ filters }) {

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    import('../../api/analytics').then(({ getCustomerAnalytics }) => {
      getCustomerAnalytics(filters)
        .then(resData => {
          if (!isMounted) return;
          if (!resData || resData.length === 0) {
            setData(DUMMY_CUSTOMER_DATA.segmentation);
          } else {
            setData(resData);
          }
          setLoading(false);
        })
        .catch(err => {
          if (!isMounted) return;
          console.error('Failed to fetch customer analytics:', err);
          setData(DUMMY_CUSTOMER_DATA.segmentation);
          setLoading(false);
        });
    });

    return () => { isMounted = false; };
  }, [filters]);

  if (loading) return <div style={{ padding: '16px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>Loading...</div>;
  if (error) return <div style={{ padding: '16px', color: 'var(--color-danger)', textAlign: 'center' }}>{error}</div>;

  return (
    <div style={{ width: '100%', padding: '16px' }}>
      <ResponsiveContainer minWidth={1} minHeight={1} width="100%" height={280}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: 'var(--color-surface-2)', border: 'none', borderRadius: '8px' }} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}