import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DUMMY_PRODUCTIVITY_DATA } from '../../data/dummyAnalyticsData';

export default function SalesProductivityWidget({ filters }) {

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    import('../../api/analytics').then(({ getSalesProductivity }) => {
      getSalesProductivity(filters)
        .then(resData => {
          if (!isMounted) return;
          if (!resData || resData.length === 0) {
            setData(DUMMY_PRODUCTIVITY_DATA.ranking.map(r => ({
              rep: r.name,
              calls: r.calls,
              emails: r.tasks * 2,
              meetings: r.meetings
            })));
          } else {
            setData(resData);
          }
          setLoading(false);
        })
        .catch(err => {
          if (!isMounted) return;
          console.error('Failed to fetch sales productivity analytics:', err);
          setData(DUMMY_PRODUCTIVITY_DATA.ranking.map(r => ({
              rep: r.name,
              calls: r.calls,
              emails: r.tasks * 2,
              meetings: r.meetings
            })));
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
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="rep" stroke="var(--color-text-secondary)" />
          <YAxis stroke="var(--color-text-secondary)" />
          <Tooltip contentStyle={{ background: 'var(--color-surface-2)', border: 'none', borderRadius: '8px' }} />
          <Legend />
          <Bar dataKey="calls" stackId="a" fill="#3b82f6" />
          <Bar dataKey="emails" stackId="a" fill="#10b981" />
          <Bar dataKey="meetings" stackId="a" fill="#8b5cf6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}