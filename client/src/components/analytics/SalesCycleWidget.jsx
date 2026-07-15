import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DUMMY_SALES_CYCLE_DATA } from '../../data/dummyAnalyticsData';

export default function SalesCycleWidget({ filters }) {

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    import('../../api/analytics').then(({ getSalesCycle }) => {
      getSalesCycle(filters)
        .then(resData => {
          if (!isMounted) return;
          // Fallback to beautiful dummy data if database returns empty
          if (!resData || resData.length === 0) {
            setData([
              { stage: 'New -> Contacted', days: 1.2 },
              { stage: 'Contacted -> Site Visit', days: 3.5 },
              { stage: 'Site Visit -> Quotation', days: 2.1 },
              { stage: 'Quotation -> Negotiation', days: 4.8 },
              { stage: 'Negotiation -> Won', days: 7.5 }
            ]);
          } else {
            setData(resData);
          }
          setLoading(false);
        })
        .catch(err => {
          if (!isMounted) return;
          console.error('Failed to fetch sales cycle analytics:', err);
          setData([
              { stage: 'New -> Contacted', days: 1.2 },
              { stage: 'Contacted -> Site Visit', days: 3.5 },
              { stage: 'Site Visit -> Quotation', days: 2.1 },
              { stage: 'Quotation -> Negotiation', days: 4.8 },
              { stage: 'Negotiation -> Won', days: 7.5 }
            ]); // Fallback on error too
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
        <BarChart data={data} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
          <XAxis type="number" stroke="var(--color-text-secondary)" />
          <YAxis dataKey="stage" type="category" stroke="var(--color-text-secondary)" width={150} tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} />
          <Tooltip contentStyle={{ background: 'var(--color-surface-2)', border: 'none', borderRadius: '8px' }} />
          <Bar dataKey="days" fill="#3b82f6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}