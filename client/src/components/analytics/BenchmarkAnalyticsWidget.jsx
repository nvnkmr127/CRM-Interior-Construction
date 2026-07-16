/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const ACCENT = '#E8935A';
const INFO = '#2563EB';

const MOCK_DATA = {
  'Time (Q3 vs Q2)': {
    entity1: 'Q3 (Current)',
    entity2: 'Q2 (Previous)',
    barData: [
      { name: 'Revenue', e1: 1500000, e2: 1200000 },
      { name: 'Leads', e1: 450, e2: 380 },
      { name: 'Won Deals', e1: 85, e2: 65 },
    ],
    trendData: [
      { month: 'M1', e1: 400000, e2: 350000 },
      { month: 'M2', e1: 500000, e2: 420000 },
      { month: 'M3', e1: 600000, e2: 430000 },
    ]
  },
  'Salesperson (Sarah vs Mike)': {
    entity1: 'Sarah Smith',
    entity2: 'Mike Johnson',
    barData: [
      { name: 'Revenue', e1: 850000, e2: 420000 },
      { name: 'Leads', e1: 120, e2: 115 },
      { name: 'Won Deals', e1: 42, e2: 18 },
    ],
    trendData: [
      { month: 'Apr', e1: 250000, e2: 120000 },
      { month: 'May', e1: 280000, e2: 140000 },
      { month: 'Jun', e1: 320000, e2: 160000 },
    ]
  },
  'Branch (NY vs London)': {
    entity1: 'New York',
    entity2: 'London',
    barData: [
      { name: 'Revenue', e1: 2400000, e2: 2100000 },
      { name: 'Leads', e1: 850, e2: 920 },
      { name: 'Won Deals', e1: 145, e2: 110 },
    ],
    trendData: [
      { month: 'Q1', e1: 700000, e2: 650000 },
      { month: 'Q2', e1: 850000, e2: 700000 },
      { month: 'Q3', e1: 850000, e2: 750000 },
    ]
  }
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '12px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      <div style={{ fontWeight: 600, marginBottom: '8px' }}>{label}</div>
      {payload.map((p, i) => {
        const val = p.name === 'Revenue' || p.value > 10000 ? `₹${(p.value/100000).toFixed(2)}L` : p.value;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color }} />
            <span style={{ color: 'var(--color-text-secondary)' }}>{p.name}:</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{val}</span>
          </div>
        )
      })}
    </div>
  );
};

export default function BenchmarkAnalyticsWidget({ onClick }) {
  const [comparison, setComparison] = useState('Time (Q3 vs Q2)');
  
  const data = MOCK_DATA[comparison];

  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: '12px', padding: '20px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--color-text)' }}>Benchmark Analytics</h2>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>Compare performance across dimensions</p>
        </div>
        <select 
          value={comparison} 
          onChange={(e) => setComparison(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', outline: 'none', cursor: 'pointer' }}
        >
          {Object.keys(MOCK_DATA).map(k => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flex: 1, minHeight: 0 }}>
        
        {/* Left Side: Bar Chart Comparison */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '16px' }}>Aggregate Comparison</h3>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer minWidth={1} minHeight={1} width="100%" height={280}>
              <BarChart data={data.barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 100000 ? `${v/100000}L` : v} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-surface-2)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="e1" name={data.entity1} fill={ACCENT} radius={[4, 4, 0, 0]} barSize={32} />
                <Bar dataKey="e2" name={data.entity2} fill={INFO} radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Side: Trend Line Comparison */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '16px' }}>Historical Trend</h3>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ResponsiveContainer minWidth={1} minHeight={1} width="100%" height={280}>
              <LineChart data={data.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 100000 ? `${v/100000}L` : v} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="e1" name={data.entity1} stroke={ACCENT} strokeWidth={3} dot={{ r: 4, fill: ACCENT, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="e2" name={data.entity2} stroke={INFO} strokeWidth={3} dot={{ r: 4, fill: INFO, strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
