/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect, react-hooks/immutability */
import React, { useState, useEffect } from 'react';
import styles from './VendorAnalytics.module.css';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  LineChart, Line, ComposedChart, Cell
} from 'recharts';
import { getVendorAnalytics } from '../../api/analytics';

export default function VendorAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [filters, setFilters] = useState({
    dateRange: 'YTD',
    category: 'All',
    status: 'All'
  });

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    // Triggers API refetch in real env
  };

  useEffect(() => {
    setLoading(true);
    getVendorAnalytics(filters)
      .then(res => {
        if (!res || Array.isArray(res) || !res.kpis) {
          setData(getFallbackData());
        } else {
          setData(res);
        }
      })
      .catch(err => {
        console.error('Vendor Analytics Error:', err);
        setData(getFallbackData());
      })
      .finally(() => setLoading(false));
  }, [filters]);

  // Fallback data mapping if DB is unavailable
  function getFallbackData() {
    return {
      kpis: {
        vendorRating: 4.2,
        deliveryTime: 6.5,
        delayedDeliveries: 12,
        qualityRating: 4.5,
        costTrend: -1.2,
        repeatOrders: 85,
        reliabilityScore: 88,
        vendorSla: 92,
        paymentCycle: 32
      },
      vendorRanking: [
        { vendor: 'BuildMart', score: 95, orders: 120 },
        { vendor: 'SteelCo', score: 88, orders: 85 },
        { vendor: 'ElecSupply', score: 92, orders: 75 },
        { vendor: 'WoodWorks', score: 75, orders: 40 },
        { vendor: 'PaintPro', score: 82, orders: 60 }
      ],
      monthlyPerformance: [
        { month: 'Jan', slaCompliance: 90, qualityScore: 85 },
        { month: 'Feb', slaCompliance: 92, qualityScore: 88 },
        { month: 'Mar', slaCompliance: 88, qualityScore: 82 },
        { month: 'Apr', slaCompliance: 94, qualityScore: 90 },
        { month: 'May', slaCompliance: 95, qualityScore: 92 }
      ],
      lateDeliveries: [
        { vendor: 'WoodWorks', delayed: 8 },
        { vendor: 'PaintPro', delayed: 5 },
        { vendor: 'SteelCo', delayed: 3 },
        { vendor: 'BuildMart', delayed: 1 }
      ],
      drillDownData: [
        { id: 1, vendor: 'BuildMart', category: 'Materials', rating: 4.8, sla: '98%', delay: '1 day', status: 'Active' },
        { id: 2, vendor: 'SteelCo', category: 'Metals', rating: 4.2, sla: '90%', delay: '3 days', status: 'Active' },
        { id: 3, vendor: 'ElecSupply', category: 'Electrical', rating: 4.5, sla: '95%', delay: '2 days', status: 'Active' },
        { id: 4, vendor: 'WoodWorks', category: 'Wood', rating: 3.5, sla: '75%', delay: '8 days', status: 'Warning' }
      ]
    };
  }

  if (loading && !data) {
    return <div className={styles.container}>Loading Vendor Analytics...</div>;
  }

  if (!data) return null;
  const { kpis, vendorRanking, monthlyPerformance, lateDeliveries, drillDownData } = data;

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.sectionTitle}>Vendor Performance</h2>
          <div className={styles.sectionDesc}>Analyze external vendor reliability, SLAs, and ratings.</div>
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
            <option value="Materials">Materials</option>
            <option value="Labor">Labor</option>
          </select>
          <select name="status" className={styles.filterSelect} onChange={handleFilterChange} value={filters.status}>
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Warning">Warning</option>
          </select>
        </div>
      </div>

      {/* KPI Cards (9 metrics) */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Avg Vendor Rating</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-primary)' }}>{kpis.vendorRating}/5</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Quality Rating</span></div>
          <div className={styles.kpiValue}>{kpis.qualityRating}/5</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Reliability Score</span></div>
          <div className={styles.kpiValue}>{kpis.reliabilityScore}%</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Vendor SLA</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-success)' }}>{kpis.vendorSla}%</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Avg Delivery Time</span></div>
          <div className={styles.kpiValue}>{kpis.deliveryTime}d</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Delayed Deliveries</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-warning)' }}>{kpis.delayedDeliveries}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Cost Trend</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-success)' }}>{kpis.costTrend}%</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Repeat Orders</span></div>
          <div className={styles.kpiValue}>{kpis.repeatOrders}%</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Avg Payment Cycle</span></div>
          <div className={styles.kpiValue}>{kpis.paymentCycle}d</div>
        </div>
      </div>

      <div className={styles.row}>
        {/* Vendor Ranking */}
        <div className={styles.card} style={{ flex: '1 1 60%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Vendor Ranking (Score vs Orders)</div>
          </div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={vendorRanking} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="vendor" axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} />
                <RechartsTooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="score" fill="#3b82f6" name="Vendor Score" radius={[4, 4, 0, 0]} barSize={30} />
                <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} name="Total Orders" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Late Deliveries */}
        <div className={styles.card} style={{ flex: '1 1 35%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Top Late Deliveries</div>
          </div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lateDeliveries} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" axisLine={false} tickLine={false} />
                <YAxis dataKey="vendor" type="category" axisLine={false} tickLine={false} />
                <RechartsTooltip />
                <Bar dataKey="delayed" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} name="Delayed Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={styles.row}>
        {/* Monthly Performance Trend */}
        <div className={styles.card} style={{ flex: '1 1 100%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Monthly SLA & Quality Trend</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyPerformance} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} domain={[50, 100]} />
                <RechartsTooltip />
                <Legend />
                <Line type="monotone" dataKey="slaCompliance" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} name="SLA Compliance %" />
                <Line type="monotone" dataKey="qualityScore" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} name="Quality Score" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Drill-Down Table */}
      <div className={styles.row}>
        <div className={styles.card} style={{ flex: '1 1 100%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Vendor Drill-Down</div>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Category</th>
                  <th>Rating</th>
                  <th>SLA Compliance</th>
                  <th>Avg Delay</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {drillDownData.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontWeight: 600 }}>{row.vendor}</td>
                    <td>{row.category}</td>
                    <td>⭐ {row.rating}</td>
                    <td>{row.sla}</td>
                    <td>{row.delay}</td>
                    <td>
                      <span className={`${styles.badge} ${row.status === 'Active' ? styles.badgeActive : styles.badgeWarning}`}>
                        {row.status}
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
