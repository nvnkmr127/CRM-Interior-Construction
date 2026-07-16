import React, { useState, useEffect } from 'react';
import styles from './MaterialAnalytics.module.css';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  LineChart, Line, ComposedChart, Cell, PieChart, Pie
} from 'recharts';
import { getMaterialAnalytics } from '../../api/analytics';

export default function MaterialAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [filters, setFilters] = useState({
    dateRange: 'YTD',
    site: 'All'
  });

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    // Triggers API refetch in real env
  };

  useEffect(() => {
    setLoading(true);
    getMaterialAnalytics(filters)
      .then(res => {
        if (!res || Array.isArray(res) || !res.kpis) {
          setData(getFallbackData());
        } else {
          setData(res);
        }
      })
      .catch(err => {
        console.error('Material Analytics Error:', err);
        setData(getFallbackData());
      })
      .finally(() => setLoading(false));
  }, [filters]);

  // Fallback data mapping if DB is unavailable
  function getFallbackData() {
    return {
      kpis: {
        materialUsage: 1250,
        materialWaste: 5.2,
        returns: 12,
        consumptionTrend: 3.5,
        materialAging: 45,
        inventoryTurnover: 8.5,
        shortagePrediction: 3
      },
      consumptionTimeline: [
        { month: 'Jan', usage: 200, waste: 10, returns: 2 },
        { month: 'Feb', usage: 220, waste: 12, returns: 1 },
        { month: 'Mar', usage: 250, waste: 15, returns: 4 },
        { month: 'Apr', usage: 280, waste: 14, returns: 2 },
        { month: 'May', usage: 300, waste: 16, returns: 3 }
      ],
      materialComparison: [
        { category: 'Steel', used: 500, allocated: 550 },
        { category: 'Cement', used: 800, allocated: 750 },
        { category: 'Wood', used: 300, allocated: 400 },
        { category: 'Glass', used: 150, allocated: 150 }
      ],
      wasteAnalysis: [
        { category: 'Steel', wastePercent: 2.5 },
        { category: 'Cement', wastePercent: 8.0 },
        { category: 'Wood', wastePercent: 12.5 },
        { category: 'Glass', wastePercent: 4.2 }
      ],
      roomWiseConsumption: [
        { name: 'Living Area', value: 450 },
        { name: 'Kitchen', value: 320 },
        { name: 'Master Bedroom', value: 280 },
        { name: 'Bathrooms', value: 200 }
      ],
      siteWiseConsumption: [
        { site: 'Site A', usage: 600 },
        { site: 'Site B', usage: 450 },
        { site: 'Site C', usage: 200 }
      ]
    };
  }

  if (loading && !data) {
    return <div className={styles.container}>Loading Material Analytics...</div>;
  }

  if (!data) return null;
  const { kpis, consumptionTimeline, materialComparison, wasteAnalysis, roomWiseConsumption, siteWiseConsumption } = data;

  const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.sectionTitle}>Material Consumption & Inventory</h2>
          <div className={styles.sectionDesc}>Monitor usage, waste percentages, and site allocations.</div>
        </div>
        
        {/* Filters */}
        <div className={styles.filtersRow}>
          <select name="dateRange" className={styles.filterSelect} onChange={handleFilterChange} value={filters.dateRange}>
            <option value="YTD">Year to Date (YTD)</option>
            <option value="Q1">Q1</option>
            <option value="Q2">Q2</option>
          </select>
          <select name="site" className={styles.filterSelect} onChange={handleFilterChange} value={filters.site}>
            <option value="All">All Sites</option>
            <option value="Site A">Site A</option>
            <option value="Site B">Site B</option>
          </select>
        </div>
      </div>

      {/* KPI Cards (7 metrics) */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Total Usage</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-primary)' }}>{kpis.materialUsage} <span style={{fontSize: '12px'}}>units</span></div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Material Waste</span></div>
          <div className={styles.kpiValue} style={{ color: kpis.materialWaste > 5 ? 'var(--color-danger)' : 'var(--color-success)' }}>
            {kpis.materialWaste}%
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Returns</span></div>
          <div className={styles.kpiValue}>{kpis.returns}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Consumption Trend</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-warning)' }}>+{kpis.consumptionTrend}%</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Material Aging</span></div>
          <div className={styles.kpiValue}>{kpis.materialAging}d</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Inventory Turnover</span></div>
          <div className={styles.kpiValue}>{kpis.inventoryTurnover}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Shortage Prediction</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-danger)' }}>{kpis.shortagePrediction}</div>
          <div className={styles.kpiSub}>Items at risk</div>
        </div>
      </div>

      <div className={styles.row}>
        {/* Consumption Timeline */}
        <div className={styles.card} style={{ flex: '1 1 100%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Consumption Timeline (Usage vs Waste vs Returns)</div>
          </div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={consumptionTimeline} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} />
                <RechartsTooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="usage" fill="#3b82f6" name="Total Usage" radius={[4, 4, 0, 0]} barSize={30} />
                <Line yAxisId="right" type="monotone" dataKey="waste" stroke="#ef4444" strokeWidth={3} name="Waste" />
                <Line yAxisId="right" type="monotone" dataKey="returns" stroke="#f59e0b" strokeWidth={3} name="Returns" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={styles.row}>
        {/* Material Comparison (Allocated vs Used) */}
        <div className={styles.card} style={{ flex: '1 1 45%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Material Allocation vs Usage</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={materialComparison} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="category" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="allocated" fill="#9ca3af" name="Allocated" radius={[4, 4, 0, 0]} barSize={25} />
                <Bar dataKey="used" fill="#3b82f6" name="Used" radius={[4, 4, 0, 0]} barSize={25}>
                  {materialComparison.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.used > entry.allocated ? '#ef4444' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Waste Analysis */}
        <div className={styles.card} style={{ flex: '1 1 45%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Waste Analysis by Category (%)</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wasteAnalysis} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="category" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <RechartsTooltip formatter={(val) => `${val}%`} />
                <Bar dataKey="wastePercent" radius={[4, 4, 0, 0]} barSize={40} name="Waste %">
                  {wasteAnalysis.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.wastePercent > 10 ? '#ef4444' : entry.wastePercent > 5 ? '#f59e0b' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={styles.row}>
        {/* Room-wise Consumption */}
        <div className={styles.card} style={{ flex: '1 1 45%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Room-wise Consumption Distribution</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={roomWiseConsumption} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                  {roomWiseConsumption.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Site-wise Consumption */}
        <div className={styles.card} style={{ flex: '1 1 45%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Site-wise Consumption Volumes</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={siteWiseConsumption} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" axisLine={false} tickLine={false} />
                <YAxis dataKey="site" type="category" axisLine={false} tickLine={false} />
                <RechartsTooltip />
                <Bar dataKey="usage" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={30} name="Usage Units" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}
