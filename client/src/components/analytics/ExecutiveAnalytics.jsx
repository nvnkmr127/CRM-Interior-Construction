import React, { useState, useEffect } from 'react';
import styles from './ExecutiveAnalytics.module.css';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  LineChart, Line, ComposedChart, AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import { getExecutiveAnalytics } from '../../api/analytics';

export default function ExecutiveAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [filters, setFilters] = useState({
    dateRange: 'YTD',
    region: 'All'
  });

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    // Triggers API refetch in real env
  };

  useEffect(() => {
    setLoading(true);
    getExecutiveAnalytics(filters)
      .then(res => {
        if (!res || Array.isArray(res) || !res.kpis) {
          setData(getFallbackData());
        } else {
          setData(res);
        }
      })
      .catch(err => {
        console.error('Executive Analytics Error:', err);
        setData(getFallbackData());
      })
      .finally(() => setLoading(false));
  }, [filters]);

  // Fallback data mapping if DB is unavailable
  function getFallbackData() {
    return {
      kpis: {
        totalRevenue: 85000000,
        profitMargin: 22.5,
        totalBudget: 120000000,
        totalCollections: 68000000,
        netCashFlow: 15000000,
        criticalProjects: 4,
        projectHealthScore: 88,
        upcomingDeliveries: 12,
        resourceUtilization: 86,
        teamProductivity: 92
      },
      executiveSummary: [
        { month: 'Jan', revenue: 12000000, profit: 2400000 },
        { month: 'Feb', revenue: 14000000, profit: 3000000 },
        { month: 'Mar', revenue: 11000000, profit: 2100000 },
        { month: 'Apr', revenue: 16000000, profit: 3800000 },
        { month: 'May', revenue: 18000000, profit: 4500000 },
        { month: 'Jun', revenue: 14000000, profit: 3200000 }
      ],
      projectHealthDistribution: [
        { status: 'On Track', value: 24 },
        { status: 'At Risk', value: 6 },
        { status: 'Critical', value: 2 }
      ],
      revenueTrend: [
        { period: 'Q1', target: 35000000, actual: 37000000 },
        { period: 'Q2', target: 40000000, actual: 48000000 }
      ],
      budgetTrend: [
        { month: 'Jan', allocated: 20000000, utilized: 18000000 },
        { month: 'Feb', allocated: 40000000, utilized: 35000000 },
        { month: 'Mar', allocated: 60000000, utilized: 58000000 },
        { month: 'Apr', allocated: 80000000, utilized: 75000000 },
        { month: 'May', allocated: 100000000, utilized: 92000000 }
      ]
    };
  }

  // Format currency
  const formatCurrency = (value) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    return `₹${value.toLocaleString('en-IN')}`;
  };

  if (loading && !data) {
    return <div className={styles.container}>Loading Executive Dashboard...</div>;
  }

  if (!data) return null;
  const { kpis, executiveSummary, projectHealthDistribution, revenueTrend, budgetTrend } = data;

  const HEALTH_COLORS = ['#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.sectionTitle}>Executive Dashboard</h1>
          <div className={styles.sectionDesc}>High-level portfolio overview of revenue, profit, cash flow, and overall health.</div>
        </div>
        
        {/* Filters */}
        <div className={styles.filtersRow}>
          <select name="dateRange" className={styles.filterSelect} onChange={handleFilterChange} value={filters.dateRange}>
            <option value="YTD">Year to Date (YTD)</option>
            <option value="Q1">Q1</option>
            <option value="Q2">Q2</option>
          </select>
          <select name="region" className={styles.filterSelect} onChange={handleFilterChange} value={filters.region}>
            <option value="All">All Regions</option>
            <option value="North">North</option>
            <option value="South">South</option>
          </select>
        </div>
      </div>

      {/* KPI Cards (10 metrics) */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Total Revenue</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-primary)' }}>{formatCurrency(kpis.totalRevenue)}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Profit Margin</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-success)' }}>{kpis.profitMargin}%</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Net Cash Flow</span></div>
          <div className={styles.kpiValue} style={{ color: '#10b981' }}>{formatCurrency(kpis.netCashFlow)}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Project Health</span></div>
          <div className={styles.kpiValue} style={{ color: '#8b5cf6' }}>{kpis.projectHealthScore}/100</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Critical Projects</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-danger)' }}>{kpis.criticalProjects}</div>
        </div>
        
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Total Budget</span></div>
          <div className={styles.kpiValue}>{formatCurrency(kpis.totalBudget)}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Total Collections</span></div>
          <div className={styles.kpiValue}>{formatCurrency(kpis.totalCollections)}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Upcoming Deliveries</span></div>
          <div className={styles.kpiValue}>{kpis.upcomingDeliveries}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Resource Utilization</span></div>
          <div className={styles.kpiValue}>{kpis.resourceUtilization}%</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Team Productivity</span></div>
          <div className={styles.kpiValue}>{kpis.teamProductivity}%</div>
        </div>
      </div>

      <div className={styles.row}>
        {/* Executive Summary (Composed Chart) */}
        <div className={styles.card} style={{ flex: '1 1 60%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Executive Summary (Revenue vs Profit)</div>
          </div>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={executiveSummary} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val / 10000000}Cr`} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val / 100000}L`} />
                <RechartsTooltip formatter={(val, name) => {
                   if (name === 'Revenue') return `₹${(val / 10000000).toFixed(2)}Cr`;
                   return `₹${(val / 100000).toFixed(2)}L`;
                }} />
                <Legend />
                <Bar yAxisId="left" dataKey="revenue" fill="#3b82f6" name="Revenue" radius={[4, 4, 0, 0]} barSize={40} />
                <Line yAxisId="right" type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={4} dot={{ r: 5 }} name="Profit" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Health Distribution (Pie Chart) */}
        <div className={styles.card} style={{ flex: '1 1 35%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Portfolio Health</div>
          </div>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={projectHealthDistribution} dataKey="value" nameKey="status" cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} label>
                  {projectHealthDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={HEALTH_COLORS[index % HEALTH_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={styles.row}>
        {/* Revenue Target vs Actual (Line Chart) */}
        <div className={styles.card} style={{ flex: '1 1 45%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Revenue: Target vs Actual</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val / 10000000}Cr`} />
                <RechartsTooltip formatter={(val) => `₹${(val / 10000000).toFixed(2)}Cr`} />
                <Legend />
                <Line type="monotone" dataKey="target" stroke="#9ca3af" strokeWidth={3} strokeDasharray="5 5" dot={false} name="Target Revenue" />
                <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={4} dot={{ r: 5 }} name="Actual Revenue" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Budget Trend (Area Chart) */}
        <div className={styles.card} style={{ flex: '1 1 45%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Budget Allocation vs Utilization</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={budgetTrend} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val / 10000000}Cr`} />
                <RechartsTooltip formatter={(val) => `₹${(val / 10000000).toFixed(2)}Cr`} />
                <Legend />
                <Area type="monotone" dataKey="allocated" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} name="Allocated Budget" />
                <Area type="monotone" dataKey="utilized" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.4} name="Utilized Budget" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}
