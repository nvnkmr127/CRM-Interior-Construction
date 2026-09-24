/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect, react-hooks/static-components */
import React, { useState, useEffect } from 'react';
import { getProfitabilityAnalytics, getVendorPerformanceReport, getCSATAnalyticsReport, getSnagsAnalytics } from '../../api/analytics';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function LeadToProjectOutcomesWidget({ filters }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groupBy, setGroupBy] = useState('source'); // 'source' or 'salesperson'

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.allSettled([
      getProfitabilityAnalytics(filters),
      getVendorPerformanceReport(),
      getCSATAnalyticsReport(),
      getSnagsAnalytics()
    ]).then((results) => {
      if (!isMounted) return;

      // Extract real data from responses
      const profitData = results[0]?.status === 'fulfilled' ? (results[0].value?.data || results[0].value) : null;
      const csatData = results[2]?.status === 'fulfilled' ? (results[2].value?.data || results[2].value) : null;
      const snagsData = results[3]?.status === 'fulfilled' ? (results[3].value?.data || results[3].value) : null;

      const sourceItems = Array.isArray(profitData?.source) ? profitData.source : (Array.isArray(profitData?.bySource) ? profitData.bySource : []);
      const salespersonItems = Array.isArray(profitData?.salesperson) ? profitData.salesperson : (Array.isArray(profitData?.bySalesperson) ? profitData.bySalesperson : []);

      // Ensure that if any API threw a fatal network error, we catch it
      const hasFatalError = results.every(r => r.status === 'rejected');
      if (hasFatalError) {
        setError('Failed to load project outcome data from backend.');
      } else {
        setData({
          source: sourceItems,
          salesperson: salespersonItems
        });
      }
      setLoading(false);
    });

    return () => { isMounted = false; };
  }, [filters]);

  if (loading) return <div style={{ padding: '16px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>Loading Project Outcomes...</div>;
  if (error) return <div style={{ padding: '16px', color: 'var(--color-danger)', textAlign: 'center' }}>{error}</div>;
  if (!data) return null;

  const activeData = data[groupBy] || [];
  
  const avgProfit = activeData.length > 0 ? (activeData.reduce((acc, curr) => acc + (curr.profitMargin || 0), 0) / activeData.length).toFixed(1) : '0.0';
  const avgCsat = activeData.length > 0 ? (activeData.reduce((acc, curr) => acc + (curr.csat || 0), 0) / activeData.length).toFixed(1) : '0.0';
  const totalSnags = activeData.reduce((acc, curr) => acc + (curr.snags || 0), 0);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '12px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <div style={{ fontWeight: 600, marginBottom: '8px' }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color }} />
            <span style={{ color: 'var(--color-text-secondary)' }}>{p.name}:</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{p.name === 'Profit Margin' ? p.value + '%' : p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--color-text)' }}>Lead-to-Project Outcomes</h2>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>Join pre-sale attributes with post-sale profitability</p>
        </div>
        <select 
          value={groupBy} 
          onChange={(e) => setGroupBy(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', outline: 'none', cursor: 'pointer' }}
        >
          <option value="source">By Lead Source</option>
          <option value="salesperson">By Salesperson</option>
        </select>
      </div>

      {/* KPI Summary Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--color-surface-2)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Avg Profit Margin</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>{avgProfit}%</div>
        </div>
        <div style={{ background: 'var(--color-surface-2)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Avg CSAT</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#3b82f6' }}>{avgCsat}/5.0</div>
        </div>
        <div style={{ background: 'var(--color-surface-2)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Total Snags</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f59e0b' }}>{totalSnags}</div>
        </div>
      </div>

      {/* Main Chart */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {activeData.length === 0 ? (
          <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
            No project outcome data recorded yet for this view.
          </div>
        ) : (
          <ResponsiveContainer minWidth={1} minHeight={1} width="100%" height={280}>
            <ComposedChart data={activeData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={v => v + '%'} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} domain={[0, 5]} />
              
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              
              <Bar yAxisId="left" dataKey="profitMargin" name="Profit Margin" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
              <Line yAxisId="right" type="monotone" dataKey="csat" name="CSAT Score" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5, fill: '#3b82f6', strokeWidth: 0 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  );
}
