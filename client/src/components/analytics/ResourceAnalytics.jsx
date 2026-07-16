import React, { useState, useEffect } from 'react';
import styles from './ResourceAnalytics.module.css';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  LineChart, Line, AreaChart, Area, Cell
} from 'recharts';
import { getResourceAnalytics } from '../../api/analytics';

function formatLakhs(val) {
  if (val === null || val === undefined) return '—';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
  return `₹${val.toLocaleString()}`;
}

export default function ResourceAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [filters, setFilters] = useState({
    department: 'All',
    employee: 'All',
    project: 'All',
    branch: 'All',
    date: 'This Month'
  });

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    // In a real scenario, this would trigger a re-fetch with params
  };

  useEffect(() => {
    setLoading(true);
    getResourceAnalytics(filters)
      .then(res => {
        if (!res || Array.isArray(res) || !res.kpis) {
          setData(getFallbackData());
        } else {
          setData(res);
        }
      })
      .catch(err => {
        console.error('Resource Analytics Error:', err);
        setData(getFallbackData());
      })
      .finally(() => setLoading(false));
  }, [filters]);

  // Fallback data mapping if DB is unavailable
  function getFallbackData() {
    return {
      kpis: {
        utilizationPercent: 82, availableCapacity: 450, idleTime: 120,
        workingHours: 3200, overtime: 145, resourceAllocation: 92,
        teamWorkload: 85, employeeCapacity: 40, departmentUtilization: 78,
        resourceCost: 4500000, resourceEfficiency: 94
      },
      heatmapData: [
        { name: 'John Doe', 'Mon': 8, 'Tue': 8, 'Wed': 9, 'Thu': 8, 'Fri': 7, total: 40 },
        { name: 'Jane Smith', 'Mon': 7, 'Tue': 8, 'Wed': 8, 'Thu': 9, 'Fri': 8, total: 40 },
        { name: 'Alice Lee', 'Mon': 9, 'Tue': 9, 'Wed': 8, 'Thu': 8, 'Fri': 8, total: 42 },
        { name: 'Bob Ray', 'Mon': 8, 'Tue': 7, 'Wed': 7, 'Thu': 8, 'Fri': 6, total: 36 }
      ],
      capacityGraph: [
        { week: 'W1', capacity: 160, utilized: 150 },
        { week: 'W2', capacity: 160, utilized: 155 },
        { week: 'W3', capacity: 160, utilized: 145 },
        { week: 'W4', capacity: 160, utilized: 165 }
      ],
      allocationTimeline: [
        { month: 'Jan', Architects: 12, Designers: 18, Engineers: 25 },
        { month: 'Feb', Architects: 14, Designers: 18, Engineers: 28 },
        { month: 'Mar', Architects: 13, Designers: 20, Engineers: 26 },
        { month: 'Apr', Architects: 15, Designers: 22, Engineers: 30 }
      ],
      deptUtilization: [
        { name: 'Design', value: 85 },
        { name: 'Engineering', value: 92 },
        { name: 'Procurement', value: 75 },
        { name: 'Project Mgmt', value: 88 }
      ],
      overtimeTrend: [
        { month: 'Jan', hours: 120 },
        { month: 'Feb', hours: 145 },
        { month: 'Mar', hours: 110 },
        { month: 'Apr', hours: 130 }
      ],
      drillDownRecords: [
        { id: 1, employee: 'John Doe', department: 'Design', project: 'Skyline Towers', hoursLogged: 40, capacity: 40, utilization: 100, status: 'Optimal' },
        { id: 2, employee: 'Jane Smith', department: 'Engineering', project: 'Ocean View', hoursLogged: 45, capacity: 40, utilization: 112, status: 'Overutilized' },
        { id: 3, employee: 'Alice Lee', department: 'Procurement', project: 'Multiple', hoursLogged: 32, capacity: 40, utilization: 80, status: 'Underutilized' }
      ]
    };
  }

  if (loading && !data) {
    return <div className={styles.container}>Loading Resource Analytics...</div>;
  }

  if (!data) return null;
  const { kpis, capacityGraph, allocationTimeline, deptUtilization, overtimeTrend, drillDownRecords, heatmapData } = data;

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.sectionTitle}>Resource Utilization & Capacity</h2>
          <div className={styles.sectionDesc}>Manage workloads, tracking allocation, efficiency, and costs.</div>
        </div>
        
        {/* Filters */}
        <div className={styles.filtersRow}>
          <select name="department" className={styles.filterSelect} onChange={handleFilterChange} value={filters.department}>
            <option value="All">All Departments</option>
            <option value="Design">Design</option>
            <option value="Engineering">Engineering</option>
            <option value="Procurement">Procurement</option>
          </select>
          <select name="branch" className={styles.filterSelect} onChange={handleFilterChange} value={filters.branch}>
            <option value="All">All Branches</option>
            <option value="Mumbai">Mumbai</option>
            <option value="Delhi">Delhi</option>
          </select>
          <select name="date" className={styles.filterSelect} onChange={handleFilterChange} value={filters.date}>
            <option value="This Week">This Week</option>
            <option value="This Month">This Month</option>
            <option value="Last Quarter">Last Quarter</option>
          </select>
        </div>
      </div>

      {/* KPI Cards (11 total) */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Utilization %</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-primary)' }}>{kpis.utilizationPercent}%</div>
          <div className={styles.kpiSub}>Overall workforce utilization</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Available Cap.</span></div>
          <div className={styles.kpiValue}>{kpis.availableCapacity}h</div>
          <div className={styles.kpiSub}>Unassigned hours remaining</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Idle Time</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-danger)' }}>{kpis.idleTime}h</div>
          <div className={styles.kpiSub}>Non-productive hours</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Working Hours</span></div>
          <div className={styles.kpiValue}>{kpis.workingHours}h</div>
          <div className={styles.kpiSub}>Total logged hours</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Overtime</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-warning)' }}>{kpis.overtime}h</div>
          <div className={styles.kpiSub}>Hours exceeding capacity</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Resource Alloc.</span></div>
          <div className={styles.kpiValue}>{kpis.resourceAllocation}%</div>
          <div className={styles.kpiSub}>Projects fully staffed</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Team Workload</span></div>
          <div className={styles.kpiValue}>{kpis.teamWorkload}%</div>
          <div className={styles.kpiSub}>Average active assignment</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Emp. Capacity</span></div>
          <div className={styles.kpiValue}>{kpis.employeeCapacity}h/w</div>
          <div className={styles.kpiSub}>Average per employee</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Dept. Utilization</span></div>
          <div className={styles.kpiValue}>{kpis.departmentUtilization}%</div>
          <div className={styles.kpiSub}>Avg department efficiency</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Resource Cost</span></div>
          <div className={styles.kpiValue}>{formatLakhs(kpis.resourceCost)}</div>
          <div className={styles.kpiSub}>Total labor costs</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Efficiency</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-success)' }}>{kpis.resourceEfficiency}%</div>
          <div className={styles.kpiSub}>Output per hour ratio</div>
        </div>
      </div>

      <div className={styles.row}>
        {/* 1. Capacity Graph (Line/Area) */}
        <div className={styles.card} style={{ flex: '1 1 45%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Capacity vs Utilized</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={capacityGraph} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUtilized" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="week" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <RechartsTooltip />
                <Legend />
                <Line type="monotone" dataKey="capacity" stroke="#9ca3af" strokeWidth={2} dot={false} name="Total Capacity" />
                <Area type="monotone" dataKey="utilized" stroke="#3b82f6" fillOpacity={1} fill="url(#colorUtilized)" name="Utilized Hours" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Resource Allocation Timeline (Stacked Bar) */}
        <div className={styles.card} style={{ flex: '1 1 45%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Resource Allocation Timeline</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={allocationTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="Architects" stackId="a" fill="#E8935A" radius={[0,0,0,0]} />
                <Bar dataKey="Designers" stackId="a" fill="#f59e0b" radius={[0,0,0,0]} />
                <Bar dataKey="Engineers" stackId="a" fill="#10b981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={styles.row}>
        {/* 3. Department Utilization (Bar Chart) */}
        <div className={styles.card} style={{ flex: '1 1 30%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Department Utilization %</div>
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptUtilization} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} />
                <RechartsTooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={16}>
                  {deptUtilization.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.value > 90 ? '#ef4444' : entry.value < 80 ? '#f59e0b' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Overtime Trend (Line Chart) */}
        <div className={styles.card} style={{ flex: '1 1 30%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Overtime Trend</div>
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={overtimeTrend} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <RechartsTooltip />
                <Line type="monotone" dataKey="hours" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. Workload Heatmap / Drill-down Table */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>Employee Workload Drill-down</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.drillDownTable}>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Project(s)</th>
                <th>Hours Logged</th>
                <th>Capacity</th>
                <th>Util. %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {drillDownRecords.map((record) => (
                <tr key={record.id}>
                  <td style={{ fontWeight: 600 }}>{record.employee}</td>
                  <td>{record.department}</td>
                  <td>{record.project}</td>
                  <td>{record.hoursLogged}h</td>
                  <td>{record.capacity}h</td>
                  <td>{record.utilization}%</td>
                  <td>
                    <span className={`${styles.statusBadge} ${record.status === 'Optimal' ? styles.statusOptimal : record.status === 'Overutilized' ? styles.statusOver : styles.statusUnder}`}>
                      {record.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
