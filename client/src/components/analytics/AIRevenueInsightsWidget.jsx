import React, { useState, useEffect } from 'react';
import { DUMMY_AI_INSIGHTS_DATA } from '../../data/dummyAnalyticsData';

export default function AIRevenueInsightsWidget({ filters }) {

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    import('../../api/analytics').then(({ getAIRevenueInsights }) => {
      getAIRevenueInsights(filters)
        .then(resData => {
          if (!isMounted) return;
          if (!resData || resData.length === 0) {
            setData(DUMMY_AI_INSIGHTS_DATA.map(i => ({
              title: i.title,
              desc: i.description,
              type: i.severity === 'Critical' ? 'negative' : (i.severity === 'Low' ? 'positive' : 'neutral')
            })));
          } else {
            setData(resData);
          }
          setLoading(false);
        })
        .catch(err => {
          if (!isMounted) return;
          console.error('Failed to fetch AI revenue insights:', err);
          setData(DUMMY_AI_INSIGHTS_DATA.map(i => ({
              title: i.title,
              desc: i.description,
              type: i.severity === 'Critical' ? 'negative' : (i.severity === 'Low' ? 'positive' : 'neutral')
            })));
          setLoading(false);
        });
    });

    return () => { isMounted = false; };
  }, [filters]);

  if (loading) return <div style={{ padding: '16px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>Loading...</div>;
  if (error) return <div style={{ padding: '16px', color: 'var(--color-danger)', textAlign: 'center' }}>{error}</div>;

  return (
    <div style={{ padding: '16px', }}>
      {data?.map((insight, i) => (
        <div key={i} style={{ padding: '12px', background: 'var(--color-surface-2)', borderRadius: '8px', marginBottom: '12px', borderLeft: `4px solid ${insight.type === 'positive' ? 'var(--color-success)' : insight.type === 'negative' ? 'var(--color-danger)' : 'var(--color-accent)'}` }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>{insight.title}</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{insight.desc}</div>
        </div>
      ))}
    </div>
  );
}