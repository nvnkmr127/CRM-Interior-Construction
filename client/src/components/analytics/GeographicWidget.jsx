/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { DUMMY_GEO_DATA } from '../../data/dummyAnalyticsData';

export default function GeographicWidget({ filters }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    import('../../api/analytics').then(({ getGeographicAnalytics }) => {
      getGeographicAnalytics(filters)
        .then(resData => {
          if (!isMounted) return;
          setData(Array.isArray(resData) ? resData : []);
          setLoading(false);
        })
        .catch(err => {
          if (!isMounted) return;
          console.error('Failed to fetch geographic analytics:', err);
          setData([]);
          setLoading(false);
        });
    });

    return () => { isMounted = false; };
  }, [filters]);

  if (loading) return <div style={{ padding: '16px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>Loading...</div>;
  if (error) return <div style={{ padding: '16px', color: 'var(--color-danger)', textAlign: 'center' }}>{error}</div>;
  if (!data || data.length === 0) return <div style={{ padding: '16px', color: 'var(--color-text-secondary)', textAlign: 'center', fontSize: '0.85rem' }}>No geographic data available.</div>;

  return (
    <div style={{ padding: '16px' }}>
      {data.map((loc, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{loc.region}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{loc.leads} Leads</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>₹{(loc.value / 100000).toFixed(1)}L</div>
            <div style={{ fontSize: '12px', color: 'var(--color-success)' }}>{loc.growth}</div>
          </div>
        </div>
      ))}
    </div>
  );
}