/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DUMMY_MARKETING_DATA } from '../../data/dummyAnalyticsData';

export default function MarketingAnalyticsWidget({ filters }) {

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    import('../../api/analytics').then(({ getMarketingAnalytics }) => {
      getMarketingAnalytics(filters)
        .then(resData => {
          if (!isMounted) return;
          if (!resData || resData.length === 0) {
            setData(DUMMY_MARKETING_DATA.byCampaign.map(c => ({...c, campaign: c.name})));
          } else {
            setData(resData);
          }
          setLoading(false);
        })
        .catch(err => {
          if (!isMounted) return;
          console.error('Failed to fetch marketing analytics:', err);
          setData(DUMMY_MARKETING_DATA.byCampaign.map(c => ({...c, campaign: c.name})));
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
          <YAxis dataKey="campaign" type="category" stroke="var(--color-text-secondary)" width={150} tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} />
          <Tooltip contentStyle={{ background: 'var(--color-surface-2)', border: 'none', borderRadius: '8px' }} />
          <Bar dataKey="leads" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}