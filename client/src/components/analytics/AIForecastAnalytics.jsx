import React, { useState, useEffect } from 'react';
import styles from './AIForecastAnalytics.module.css';
import { 
  ComposedChart, Line, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';
import { getAIForecastAnalytics } from '../../api/analytics';

export default function AIForecastAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [filters, setFilters] = useState({
    horizon: '3M'
  });

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    // Triggers API refetch in real env
  };

  useEffect(() => {
    setLoading(true);
    getAIForecastAnalytics(filters)
      .then(res => {
        if (!res || Array.isArray(res) || !res.kpis) {
          setData(getFallbackData());
        } else {
          setData(res);
        }
      })
      .catch(err => {
        console.error('AI Forecast Analytics Error:', err);
        setData(getFallbackData());
      })
      .finally(() => setLoading(false));
  }, [filters]);

  // Fallback data mapping if DB is unavailable
  function getFallbackData() {
    return {
      kpis: {
        completionDate: '2026-11-15',
        completionConfidence: 85,
        budgetOverrun: 1250000,
        budgetConfidence: 78,
        profitMargin: 21.5,
        profitConfidence: 82,
        cashRequirement: 4500000,
        cashConfidence: 90,
        materialShortage: 3,
        materialConfidence: 75,
        vendorDelay: 12,
        vendorConfidence: 88,
        projectDelay: 14,
        delayConfidence: 85,
        riskScore: 7.2,
        riskConfidence: 80,
        completionProbability: 92
      },
      cashForecast: [
        { month: 'Jul', actual: 12000000, forecast: null, upper: null, lower: null },
        { month: 'Aug', actual: 14000000, forecast: null, upper: null, lower: null },
        { month: 'Sep', actual: null, forecast: 13000000, upper: 14000000, lower: 12000000 },
        { month: 'Oct', actual: null, forecast: 15000000, upper: 16500000, lower: 13500000 },
        { month: 'Nov', actual: null, forecast: 11000000, upper: 12500000, lower: 9500000 }
      ],
      delayProbability: [
        { days: '0-5', probability: 10 },
        { days: '6-10', probability: 25 },
        { days: '11-15', probability: 45 },
        { days: '16-20', probability: 15 },
        { days: '>20', probability: 5 }
      ],
      profitMarginTrend: [
        { month: 'Jul', actual: 23.0, forecast: null, upper: null, lower: null },
        { month: 'Aug', actual: 22.5, forecast: null, upper: null, lower: null },
        { month: 'Sep', actual: null, forecast: 22.0, upper: 23.5, lower: 20.5 },
        { month: 'Oct', actual: null, forecast: 21.5, upper: 23.0, lower: 20.0 },
        { month: 'Nov', actual: null, forecast: 21.8, upper: 23.2, lower: 20.4 }
      ]
    };
  }

  // Format currency
  const formatCurrency = (value) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    return `₹${value.toLocaleString('en-IN')}`;
  };

  const getConfidenceStyle = (score) => {
    return score >= 80 ? styles.kpiConfidence : `${styles.kpiConfidence} ${styles.confidenceWarning}`;
  };

  if (loading && !data) {
    return <div className={styles.container}>Loading AI Forecast Analytics...</div>;
  }

  if (!data) return null;
  const { kpis, cashForecast, delayProbability, profitMarginTrend } = data;

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.sectionTitle}>
            <span className={styles.aiBadge}>✨ AI</span>
            Predictive Forecast
          </h2>
          <div className={styles.sectionDesc}>Simulated ML forecasting for completion, budget, and risk outcomes based on historical data.</div>
        </div>
        
        {/* Filters */}
        <div className={styles.filtersRow}>
          <select name="horizon" className={styles.filterSelect} onChange={handleFilterChange} value={filters.horizon}>
            <option value="1M">1 Month Horizon</option>
            <option value="3M">3 Month Horizon</option>
            <option value="6M">6 Month Horizon</option>
          </select>
        </div>
      </div>

      {/* KPI Cards (9 metrics) */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Projected Completion</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-primary)' }}>{new Date(kpis.completionDate).toLocaleDateString('en-IN', {month:'short', year:'numeric'})}</div>
          <div className={getConfidenceStyle(kpis.completionConfidence)}>🤖 {kpis.completionConfidence}% Confident</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Completion Probability</span></div>
          <div className={styles.kpiValue} style={{ color: '#10b981' }}>{kpis.completionProbability}%</div>
          <div className={styles.kpiConfidence} style={{background:'transparent', padding:0}}>High Likelihood</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Predicted Delay</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-danger)' }}>{kpis.projectDelay} Days</div>
          <div className={getConfidenceStyle(kpis.delayConfidence)}>🤖 {kpis.delayConfidence}% Confident</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Risk Score Forecast</span></div>
          <div className={styles.kpiValue} style={{ color: '#f59e0b' }}>{kpis.riskScore}/10</div>
          <div className={getConfidenceStyle(kpis.riskConfidence)}>🤖 {kpis.riskConfidence}% Confident</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Est. Budget Overrun</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-danger)' }}>{formatCurrency(kpis.budgetOverrun)}</div>
          <div className={getConfidenceStyle(kpis.budgetConfidence)}>🤖 {kpis.budgetConfidence}% Confident</div>
        </div>
        
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Predicted Profit Margin</span></div>
          <div className={styles.kpiValue} style={{ color: '#8b5cf6' }}>{kpis.profitMargin}%</div>
          <div className={getConfidenceStyle(kpis.profitConfidence)}>🤖 {kpis.profitConfidence}% Confident</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Next Cash Requirement</span></div>
          <div className={styles.kpiValue}>{formatCurrency(kpis.cashRequirement)}</div>
          <div className={getConfidenceStyle(kpis.cashConfidence)}>🤖 {kpis.cashConfidence}% Confident</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Vendor Delay Risk</span></div>
          <div className={styles.kpiValue}>{kpis.vendorDelay} Days</div>
          <div className={getConfidenceStyle(kpis.vendorConfidence)}>🤖 {kpis.vendorConfidence}% Confident</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Material Shortage Risk</span></div>
          <div className={styles.kpiValue}>{kpis.materialShortage} Items</div>
          <div className={getConfidenceStyle(kpis.materialConfidence)}>🤖 {kpis.materialConfidence}% Confident</div>
        </div>
      </div>

      <div className={styles.row}>
        {/* Cash Forecast (Composed Chart) */}
        <div className={styles.card} style={{ flex: '1 1 50%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Cash Flow: Actual vs AI Forecast</div>
          </div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cashForecast} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val / 10000000}Cr`} />
                <RechartsTooltip formatter={(val) => `₹${(val / 10000000).toFixed(2)}Cr`} />
                <Legend />
                <Bar dataKey="actual" fill="#9ca3af" name="Actual Cash" radius={[4, 4, 0, 0]} maxBarSize={50} />
                <Line type="monotone" dataKey="forecast" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 5 }} name="AI Forecast" />
                <Area type="monotone" dataKey="upper" stroke="none" fill="#8b5cf6" fillOpacity={0.1} name="Upper Bound" />
                <Area type="monotone" dataKey="lower" stroke="none" fill="#8b5cf6" fillOpacity={0.1} name="Lower Bound" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Delay Probability (Area Chart) */}
        <div className={styles.card} style={{ flex: '1 1 45%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Project Delay Probability Distribution</div>
          </div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={delayProbability} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="days" axisLine={false} tickLine={false} label={{ value: 'Days Delayed', position: 'insideBottom', offset: -5 }} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} />
                <RechartsTooltip formatter={(val) => `${val}%`} />
                <Legend />
                <Area type="monotone" dataKey="probability" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} name="Probability %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      <div className={styles.row}>
        {/* Profit Margin Forecast */}
        <div className={styles.card} style={{ flex: '1 1 100%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Profit Margin Trend & AI Forecast</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={profitMarginTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} domain={['dataMin - 2', 'dataMax + 2']} />
                <RechartsTooltip formatter={(val) => `${val}%`} />
                <Legend />
                <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={3} name="Actual Margin" dot={{ r: 4 }} />
                <Line type="monotone" dataKey="forecast" stroke="#3b82f6" strokeWidth={3} strokeDasharray="5 5" name="AI Forecast Margin" dot={{ r: 4 }} />
                <Area type="monotone" dataKey="upper" stroke="none" fill="#3b82f6" fillOpacity={0.1} name="Upper Bound" />
                <Area type="monotone" dataKey="lower" stroke="none" fill="#3b82f6" fillOpacity={0.1} name="Lower Bound" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}
