import React, { useState, useEffect } from 'react';
import styles from './DelayAnalytics.module.css';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  LineChart, Line, ComposedChart, AreaChart, Area, Cell, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { getDelayAnalytics } from '../../api/analytics';

export default function DelayAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [filters, setFilters] = useState({
    dateRange: 'YTD',
    phase: 'All'
  });

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    // Triggers API refetch in real env
  };

  useEffect(() => {
    setLoading(true);
    getDelayAnalytics(filters)
      .then(res => {
        if (!res || Array.isArray(res) || !res.kpis) {
          setData(getFallbackData());
        } else {
          setData(res);
        }
      })
      .catch(err => {
        console.error('Delay Analytics Error:', err);
        setData(getFallbackData());
      })
      .finally(() => setLoading(false));
  }, [filters]);

  // Fallback data mapping if DB is unavailable
  function getFallbackData() {
    return {
      kpis: {
        totalDelayDays: 45,
        recoveryRate: 65,
        vendorDelays: 12,
        materialDelays: 8,
        approvalDelays: 15,
        laborDelays: 6,
        weatherDelays: 4,
        clientDelays: 10
      },
      delayTrend: [
        { month: 'Jan', totalDelay: 5, recovered: 2 },
        { month: 'Feb', totalDelay: 8, recovered: 4 },
        { month: 'Mar', totalDelay: 12, recovered: 5 },
        { month: 'Apr', totalDelay: 15, recovered: 10 },
        { month: 'May', totalDelay: 5, recovered: 8 }
      ],
      delayDistribution: [
        { name: 'Vendor Issues', value: 12 },
        { name: 'Material Shortage', value: 8 },
        { name: 'Approvals', value: 15 },
        { name: 'Labor Shortage', value: 6 },
        { name: 'Client Changes', value: 10 }
      ],
      delayHeatmap: [
        { category: 'Vendor', severity: 3, frequency: 5 },
        { category: 'Material', severity: 4, frequency: 3 },
        { category: 'Approvals', severity: 5, frequency: 8 },
        { category: 'Labor', severity: 2, frequency: 4 },
        { category: 'Weather', severity: 1, frequency: 2 }
      ]
    };
  }

  if (loading && !data) {
    return <div className={styles.container}>Loading Delay Analytics...</div>;
  }

  if (!data) return null;
  const { kpis, delayTrend, delayDistribution, delayHeatmap } = data;

  const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981'];

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.sectionTitle}>Project Delays & Bottlenecks</h2>
          <div className={styles.sectionDesc}>Categorize root causes of schedule slippage and measure recovery rates.</div>
        </div>
        
        {/* Filters */}
        <div className={styles.filtersRow}>
          <select name="dateRange" className={styles.filterSelect} onChange={handleFilterChange} value={filters.dateRange}>
            <option value="YTD">Year to Date (YTD)</option>
            <option value="Q1">Q1</option>
            <option value="Q2">Q2</option>
          </select>
          <select name="phase" className={styles.filterSelect} onChange={handleFilterChange} value={filters.phase}>
            <option value="All">All Phases</option>
            <option value="Design">Design</option>
            <option value="Procurement">Procurement</option>
            <option value="Execution">Execution</option>
          </select>
        </div>
      </div>

      {/* KPI Cards (8 metrics) */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Total Delay Days</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-danger)' }}>{kpis.totalDelayDays}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Recovery Rate</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-success)' }}>{kpis.recoveryRate}%</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Vendor Delays</span></div>
          <div className={styles.kpiValue}>{kpis.vendorDelays}d</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Material Delays</span></div>
          <div className={styles.kpiValue}>{kpis.materialDelays}d</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Approval Delays</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-warning)' }}>{kpis.approvalDelays}d</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Client Delays</span></div>
          <div className={styles.kpiValue}>{kpis.clientDelays}d</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Labor Delays</span></div>
          <div className={styles.kpiValue}>{kpis.laborDelays}d</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Weather Delays</span></div>
          <div className={styles.kpiValue}>{kpis.weatherDelays}d</div>
        </div>
      </div>

      <div className={styles.row}>
        {/* Delay Trend (Composed Chart) */}
        <div className={styles.card} style={{ flex: '1 1 55%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Delay vs Recovery Trend</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={delayTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="totalDelay" fill="#ef4444" name="Delay Days" radius={[4, 4, 0, 0]} barSize={30} />
                <Line type="monotone" dataKey="recovered" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} name="Recovered Days" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Delay Distribution (Bar Chart) */}
        <div className={styles.card} style={{ flex: '1 1 40%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Delay Distribution by Cause</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={delayDistribution} margin={{ top: 10, right: 10, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} />
                <RechartsTooltip formatter={(val) => `${val} days`} />
                <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} name="Days Delayed">
                  {delayDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={styles.row}>
        {/* Delay Heatmap (Scatter Chart) */}
        <div className={styles.card} style={{ flex: '1 1 100%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Risk Matrix (Severity vs Frequency)</div>
          </div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="category" dataKey="category" name="Category" />
                <YAxis type="number" dataKey="severity" name="Severity (1-5)" domain={[0, 5]} />
                <ZAxis type="number" dataKey="frequency" range={[100, 1000]} name="Frequency" />
                <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} />
                <Legend />
                <Scatter name="Delay Risks" data={delayHeatmap} fill="#8b5cf6" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}
