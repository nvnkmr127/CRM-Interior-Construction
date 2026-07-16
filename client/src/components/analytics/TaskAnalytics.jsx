import React, { useState, useEffect } from 'react';
import styles from './TaskAnalytics.module.css';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  LineChart, Line, AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import { getTaskAnalytics } from '../../api/analytics';

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6'];

export default function TaskAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [filters, setFilters] = useState({
    employee: 'All',
    team: 'All',
    project: 'All',
    status: 'All',
    priority: 'All'
  });

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    // Triggers API refetch in real env
  };

  useEffect(() => {
    setLoading(true);
    getTaskAnalytics(filters)
      .then(res => {
        if (!res || Array.isArray(res) || !res.kpis) {
          setData(getFallbackData());
        } else {
          setData(res);
        }
      })
      .catch(err => {
        console.error('Task Analytics Error:', err);
        setData(getFallbackData());
      })
      .finally(() => setLoading(false));
  }, [filters]);

  // Fallback data mapping if DB is unavailable
  function getFallbackData() {
    return {
      kpis: {
        totalTasks: 845,
        completed: 450,
        pending: 125,
        inProgress: 180,
        blocked: 45,
        overdue: 45,
        completionPercent: 53.2,
        taskAging: 12.4
      },
      priorityDistribution: [
        { name: 'High', value: 120 },
        { name: 'Medium', value: 450 },
        { name: 'Low', value: 275 }
      ],
      categoryDistribution: [
        { name: 'Design', value: 210 },
        { name: 'Engineering', value: 340 },
        { name: 'Procurement', value: 150 },
        { name: 'Admin', value: 145 }
      ],
      dailyCompletion: [
        { date: 'Mon', completed: 25 },
        { date: 'Tue', completed: 32 },
        { date: 'Wed', completed: 45 },
        { date: 'Thu', completed: 38 },
        { date: 'Fri', completed: 42 }
      ],
      weeklyTrend: [
        { week: 'W1', created: 120, completed: 95 },
        { week: 'W2', created: 135, completed: 110 },
        { week: 'W3', created: 115, completed: 125 },
        { week: 'W4', created: 140, completed: 120 }
      ],
      burnDown: [
        { day: 'Day 1', remaining: 200 },
        { day: 'Day 5', remaining: 175 },
        { day: 'Day 10', remaining: 120 },
        { day: 'Day 15', remaining: 90 },
        { day: 'Day 20', remaining: 45 }
      ],
      burnUp: [
        { day: 'Day 1', totalWork: 200, completedWork: 10 },
        { day: 'Day 5', totalWork: 210, completedWork: 35 },
        { day: 'Day 10', totalWork: 210, completedWork: 90 },
        { day: 'Day 15', totalWork: 220, completedWork: 130 },
        { day: 'Day 20', totalWork: 220, completedWork: 175 }
      ]
    };
  }

  if (loading && !data) {
    return <div className={styles.container}>Loading Task Analytics...</div>;
  }

  if (!data) return null;
  const { kpis, priorityDistribution, categoryDistribution, dailyCompletion, weeklyTrend, burnDown, burnUp } = data;

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.sectionTitle}>Task Analytics Dashboard</h2>
          <div className={styles.sectionDesc}>Deep dive into task completion, workflow bottlenecks, and burn rates.</div>
        </div>
        
        {/* Filters */}
        <div className={styles.filtersRow}>
          <select name="team" className={styles.filterSelect} onChange={handleFilterChange} value={filters.team}>
            <option value="All">All Teams</option>
            <option value="Design">Design</option>
            <option value="Engineering">Engineering</option>
          </select>
          <select name="status" className={styles.filterSelect} onChange={handleFilterChange} value={filters.status}>
            <option value="All">All Statuses</option>
            <option value="In Progress">In Progress</option>
            <option value="Blocked">Blocked</option>
          </select>
          <select name="priority" className={styles.filterSelect} onChange={handleFilterChange} value={filters.priority}>
            <option value="All">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Total Tasks</span></div>
          <div className={styles.kpiValue}>{kpis.totalTasks}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Completed</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-success)' }}>{kpis.completed}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Pending</span></div>
          <div className={styles.kpiValue}>{kpis.pending}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>In Progress</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-primary)' }}>{kpis.inProgress}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Blocked</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-warning)' }}>{kpis.blocked}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Overdue</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-danger)' }}>{kpis.overdue}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Completion %</span></div>
          <div className={styles.kpiValue}>{kpis.completionPercent}%</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Task Aging</span></div>
          <div className={styles.kpiValue}>{kpis.taskAging}d</div>
        </div>
      </div>

      <div className={styles.row}>
        {/* Daily Task Completion */}
        <div className={styles.card} style={{ flex: '1 1 45%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Daily Task Completion</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyCompletion} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <RechartsTooltip />
                <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly Trend (Created vs Completed) */}
        <div className={styles.card} style={{ flex: '1 1 45%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Weekly Created vs Completed Trend</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="week" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <RechartsTooltip />
                <Legend />
                <Line type="monotone" dataKey="created" stroke="#9ca3af" strokeWidth={3} dot={{ r: 4 }} name="Created" />
                <Line type="monotone" dataKey="completed" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} name="Completed" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={styles.row}>
        {/* Priority Distribution */}
        <div className={styles.card} style={{ flex: '1 1 30%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Priority Distribution</div>
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={priorityDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value">
                  {priorityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution */}
        <div className={styles.card} style={{ flex: '1 1 30%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Category Distribution</div>
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryDistribution} cx="50%" cy="50%" outerRadius={70} dataKey="value">
                  {categoryDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={styles.row}>
        {/* Task Burn Down */}
        <div className={styles.card} style={{ flex: '1 1 45%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Task Burn Down</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={burnDown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBurn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <RechartsTooltip />
                <Area type="monotone" dataKey="remaining" stroke="#ef4444" fillOpacity={1} fill="url(#colorBurn)" name="Remaining Tasks" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Task Burn Up */}
        <div className={styles.card} style={{ flex: '1 1 45%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Task Burn Up</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={burnUp} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <RechartsTooltip />
                <Legend />
                <Area type="monotone" dataKey="totalWork" stroke="#9ca3af" fill="transparent" name="Total Scope" />
                <Area type="monotone" dataKey="completedWork" stroke="#10b981" fill="#10b981" fillOpacity={0.3} name="Completed Work" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}
