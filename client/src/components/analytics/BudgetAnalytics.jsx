/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect, react-hooks/immutability */
import React, { useState, useEffect } from 'react';
import styles from './BudgetAnalytics.module.css';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  LineChart, Line, AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import { getBudgetAnalytics } from '../../api/analytics';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
};

export default function BudgetAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [filters, setFilters] = useState({
    dateRange: 'YTD',
    department: 'All'
  });

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    // Triggers API refetch in real env
  };

  useEffect(() => {
    setLoading(true);
    getBudgetAnalytics(filters)
      .then(res => {
        if (!res || Array.isArray(res) || !res.kpis) {
          setData(getFallbackData());
        } else {
          setData(res);
        }
      })
      .catch(err => {
        console.error('Budget Analytics Error:', err);
        setData(getFallbackData());
      })
      .finally(() => setLoading(false));
  }, [filters]);

  // Fallback data mapping if DB is unavailable
  function getFallbackData() {
    return {
      kpis: {
        budgetAllocated: 1500000,
        budgetUtilized: 850000,
        remainingBudget: 650000,
        burnRate: 125000,
        unexpectedExpenses: 45000,
        dailySpending: 4166,
        forecastBudget: 1600000
      },
      costBreakdown: [
        { name: 'Materials', value: 450000 },
        { name: 'Labor', value: 250000 },
        { name: 'Equipment', value: 100000 },
        { name: 'Permits', value: 50000 }
      ],
      budgetTrend: [
        { month: 'Jan', allocated: 200000, utilized: 180000, unexpected: 5000 },
        { month: 'Feb', allocated: 250000, utilized: 260000, unexpected: 15000 },
        { month: 'Mar', allocated: 300000, utilized: 280000, unexpected: 8000 },
        { month: 'Apr', allocated: 150000, utilized: 130000, unexpected: 0 }
      ],
      departmentComparison: [
        { dept: 'Design', budget: 150000, actual: 145000 },
        { dept: 'Engineering', budget: 500000, actual: 480000 },
        { dept: 'Procurement', budget: 600000, actual: 650000 },
        { dept: 'Admin', budget: 50000, actual: 45000 }
      ],
      phaseCost: [
        { phase: 'Planning', cost: 80000, status: 'Complete' },
        { phase: 'Design', cost: 120000, status: 'Complete' },
        { phase: 'Execution', cost: 550000, status: 'In Progress' },
        { phase: 'Handover', cost: 0, status: 'Pending' }
      ]
    };
  }

  if (loading && !data) {
    return <div className={styles.container}>Loading Budget Analytics...</div>;
  }

  if (!data) return null;
  const { kpis, costBreakdown, budgetTrend, departmentComparison, phaseCost } = data;

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.sectionTitle}>Budget & Cost Analytics</h2>
          <div className={styles.sectionDesc}>Comprehensive view of budget utilization, variances, and financial forecasting.</div>
        </div>
        
        {/* Filters */}
        <div className={styles.filtersRow}>
          <select name="dateRange" className={styles.filterSelect} onChange={handleFilterChange} value={filters.dateRange}>
            <option value="YTD">Year to Date (YTD)</option>
            <option value="Q1">Q1</option>
            <option value="Q2">Q2</option>
            <option value="Q3">Q3</option>
            <option value="Q4">Q4</option>
          </select>
          <select name="department" className={styles.filterSelect} onChange={handleFilterChange} value={filters.department}>
            <option value="All">All Departments</option>
            <option value="Design">Design</option>
            <option value="Engineering">Engineering</option>
            <option value="Procurement">Procurement</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Allocated</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-primary)' }}>{formatCurrency(kpis.budgetAllocated)}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Utilized</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-success)' }}>{formatCurrency(kpis.budgetUtilized)}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Remaining</span></div>
          <div className={styles.kpiValue}>{formatCurrency(kpis.remainingBudget)}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Forecast</span></div>
          <div className={styles.kpiValue} style={{ color: kpis.forecastBudget > kpis.budgetAllocated ? 'var(--color-danger)' : 'var(--color-text)' }}>
            {formatCurrency(kpis.forecastBudget)}
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Burn Rate (Mo)</span></div>
          <div className={styles.kpiValue}>{formatCurrency(kpis.burnRate)}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Daily Spend</span></div>
          <div className={styles.kpiValue}>{formatCurrency(kpis.dailySpending)}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Unexpected</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-warning)' }}>{formatCurrency(kpis.unexpectedExpenses)}</div>
        </div>
      </div>

      <div className={styles.row}>
        {/* Budget Trend (Area Chart) */}
        <div className={styles.card} style={{ flex: '1 1 50%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Budget Trend (Allocated vs Utilized)</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={budgetTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val / 1000}k`} />
                <RechartsTooltip formatter={(val) => formatCurrency(val)} />
                <Legend />
                <Area type="monotone" dataKey="allocated" stroke="#9ca3af" fill="transparent" name="Allocated" />
                <Area type="monotone" dataKey="utilized" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Utilized" />
                <Area type="monotone" dataKey="unexpected" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Unexpected" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost Breakdown (Pie Chart) */}
        <div className={styles.card} style={{ flex: '1 1 30%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Cost Breakdown</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={costBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={5}>
                  {costBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(val) => formatCurrency(val)} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={styles.row}>
        {/* Department Comparison (Bar Chart) */}
        <div className={styles.card} style={{ flex: '1 1 60%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Department Variance (Budget vs Actual)</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentComparison} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dept" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val / 1000}k`} />
                <RechartsTooltip formatter={(val) => formatCurrency(val)} />
                <Legend />
                <Bar dataKey="budget" fill="#9ca3af" radius={[4, 4, 0, 0]} name="Budget" barSize={30} />
                <Bar dataKey="actual" radius={[4, 4, 0, 0]} name="Actual" barSize={30}>
                  {departmentComparison.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.actual > entry.budget ? '#ef4444' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Phase Drill Down */}
        <div className={styles.card} style={{ flex: '1 1 35%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Project Phase Cost</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.drillDownTable}>
              <thead>
                <tr>
                  <th>Phase</th>
                  <th>Cost</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {phaseCost.map((phase, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{phase.phase}</td>
                    <td>{formatCurrency(phase.cost)}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${phase.status === 'Complete' ? styles.statusSuccess : phase.status === 'In Progress' ? styles.statusWarning : ''}`}>
                        {phase.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
