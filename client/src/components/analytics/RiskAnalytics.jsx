/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect, react-hooks/immutability */
import React, { useState, useEffect } from 'react';
import styles from './RiskAnalytics.module.css';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import { getRiskAnalytics } from '../../api/analytics';

export default function RiskAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [filters, setFilters] = useState({
    dateRange: 'YTD',
    category: 'All'
  });

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    // Triggers API refetch in real env
  };

  useEffect(() => {
    setLoading(true);
    getRiskAnalytics(filters)
      .then(res => {
        if (!res || Array.isArray(res) || !res.kpis) {
          setData(getFallbackData());
        } else {
          setData(res);
        }
      })
      .catch(err => {
        console.error('Risk Analytics Error:', err);
        setData(getFallbackData());
      })
      .finally(() => setLoading(false));
  }, [filters]);

  // Fallback data mapping if DB is unavailable
  function getFallbackData() {
    return {
      kpis: {
        totalRisks: 34,
        openRisks: 12,
        resolvedRisks: 22,
        highRiskProjects: 3,
        avgRiskScore: 6.8,
        mitigationRate: 64,
        avgProbability: 3.5,
        avgImpact: 4.2
      },
      riskHeatmap: [
        { id: 'R1', probability: 4, impact: 5, category: 'Financial', score: 20 },
        { id: 'R2', probability: 3, impact: 4, category: 'Schedule', score: 12 },
        { id: 'R3', probability: 5, impact: 3, category: 'Material', score: 15 },
        { id: 'R4', probability: 2, impact: 2, category: 'Labor', score: 4 },
        { id: 'R5', probability: 4, impact: 4, category: 'Design', score: 16 },
        { id: 'R6', probability: 1, impact: 5, category: 'Safety', score: 5 }
      ],
      riskTrend: [
        { month: 'Jan', open: 8, resolved: 5 },
        { month: 'Feb', open: 10, resolved: 7 },
        { month: 'Mar', open: 15, resolved: 10 },
        { month: 'Apr', open: 12, resolved: 14 },
        { month: 'May', open: 12, resolved: 22 }
      ],
      riskDistribution: [
        { category: 'Financial', value: 8 },
        { category: 'Schedule', value: 12 },
        { category: 'Material', value: 6 },
        { category: 'Labor', value: 5 },
        { category: 'Safety', value: 3 }
      ]
    };
  }

  if (loading && !data) {
    return <div className={styles.container}>Loading Risk Analytics...</div>;
  }

  if (!data) return null;
  const { kpis, riskHeatmap, riskTrend, riskDistribution } = data;

  const PIE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'];

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.sectionTitle}>Risk & Mitigation Analytics</h2>
          <div className={styles.sectionDesc}>Monitor project risks, probability, impact, and mitigation success.</div>
        </div>
        
        {/* Filters */}
        <div className={styles.filtersRow}>
          <select name="dateRange" className={styles.filterSelect} onChange={handleFilterChange} value={filters.dateRange}>
            <option value="YTD">Year to Date (YTD)</option>
            <option value="Q1">Q1</option>
            <option value="Q2">Q2</option>
          </select>
          <select name="category" className={styles.filterSelect} onChange={handleFilterChange} value={filters.category}>
            <option value="All">All Categories</option>
            <option value="Financial">Financial</option>
            <option value="Schedule">Schedule</option>
            <option value="Safety">Safety</option>
          </select>
        </div>
      </div>

      {/* KPI Cards (8 metrics) */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Total Risks</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-primary)' }}>{kpis.totalRisks}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Open Risks</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-danger)' }}>{kpis.openRisks}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Resolved Risks</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-success)' }}>{kpis.resolvedRisks}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>High Risk Projects</span></div>
          <div className={styles.kpiValue} style={{ color: '#f59e0b' }}>{kpis.highRiskProjects}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Avg Risk Score</span></div>
          <div className={styles.kpiValue}>{kpis.avgRiskScore}/10</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Mitigation Rate</span></div>
          <div className={styles.kpiValue} style={{ color: '#8b5cf6' }}>{kpis.mitigationRate}%</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Avg Probability</span></div>
          <div className={styles.kpiValue}>{kpis.avgProbability}/5</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Avg Impact</span></div>
          <div className={styles.kpiValue}>{kpis.avgImpact}/5</div>
        </div>
      </div>

      <div className={styles.row}>
        {/* Risk Trend (Area Chart) */}
        <div className={styles.card} style={{ flex: '1 1 55%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Open vs Resolved Risks Trend</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={riskTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <RechartsTooltip />
                <Legend />
                <Area type="monotone" dataKey="open" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} name="Open Risks" />
                <Area type="monotone" dataKey="resolved" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Resolved Risks" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Distribution (Pie Chart) */}
        <div className={styles.card} style={{ flex: '1 1 40%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Risks by Category</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskDistribution} dataKey="value" nameKey="category" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} label>
                  {riskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
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
        {/* Risk Heatmap (Scatter Chart) */}
        <div className={styles.card} style={{ flex: '1 1 100%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Risk Heatmap (Probability vs Impact)</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="probability" name="Probability" domain={[0, 5]} tickCount={6} label={{ value: 'Probability (1-5)', position: 'insideBottom', offset: -5 }} />
                <YAxis type="number" dataKey="impact" name="Impact" domain={[0, 5]} tickCount={6} label={{ value: 'Impact (1-5)', angle: -90, position: 'insideLeft' }} />
                <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value, name) => [value, name]} />
                <Scatter name="Risks" data={riskHeatmap} fill="#ef4444">
                  {riskHeatmap.map((entry, index) => {
                    // Color code based on Risk Score (Probability x Impact)
                    let color = '#10b981'; // Green for low
                    if (entry.score > 9) color = '#f59e0b'; // Yellow/Orange for medium
                    if (entry.score >= 15) color = '#ef4444'; // Red for high
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}
