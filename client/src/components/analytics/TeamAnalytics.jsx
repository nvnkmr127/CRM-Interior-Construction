import React, { useState, useEffect } from 'react';
import styles from './TeamAnalytics.module.css';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  LineChart, Line, AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import { getTeamAnalytics } from '../../api/analytics';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export default function TeamAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [filters, setFilters] = useState({
    department: 'All',
    role: 'All',
    date: 'This Month'
  });

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
    // In a real scenario, this triggers a re-fetch with params
  };

  useEffect(() => {
    setLoading(true);
    getTeamAnalytics(filters)
      .then(res => {
        if (!res || Array.isArray(res) || !res.kpis) {
          setData(getFallbackData());
        } else {
          setData(res);
        }
      })
      .catch(err => {
        console.error('Team Analytics Error:', err);
        setData(getFallbackData());
      })
      .finally(() => setLoading(false));
  }, [filters]);

  // Fallback data mapping if DB is unavailable
  function getFallbackData() {
    return {
      kpis: {
        tasksCompleted: 450,
        tasksPending: 125,
        tasksOverdue: 22,
        avgCompletionTime: 4.5,
        productivityScore: 88,
        qualityScore: 92,
        attendanceImpact: 96,
        siteVisits: 114,
        clientRatings: 4.6,
        reworkPercent: 4.2,
        efficiencyScore: 89
      },
      leaderboards: {
        bestPerformer: { name: 'Sarah Connor', role: 'Sr. Designer', score: 98, avatar: '👩‍🎨' },
        mostProductiveDesigner: { name: 'Michael Chen', role: 'Designer', score: 95, tasks: 45 },
        bestProjectManager: { name: 'David Smith', role: 'Project Manager', score: 94, onTime: '98%' },
        highestClientRating: { name: 'Elena Rodriguez', role: 'Client Success', rating: 4.9, reviews: 32 }
      },
      productivityTrend: [
        { month: 'Jan', productivity: 75, quality: 80 },
        { month: 'Feb', productivity: 82, quality: 84 },
        { month: 'Mar', productivity: 88, quality: 86 },
        { month: 'Apr', productivity: 85, quality: 90 },
        { month: 'May', productivity: 92, quality: 92 }
      ],
      teamComparison: [
        { team: 'Design', score: 92 },
        { team: 'Engineering', score: 85 },
        { team: 'Procurement', score: 78 },
        { team: 'Management', score: 88 }
      ],
      performanceDistribution: [
        { name: 'Top Performers (>90%)', value: 25 },
        { name: 'Average (70-90%)', value: 60 },
        { name: 'Needs Improvement (<70%)', value: 15 }
      ],
      drillDownRecords: [
        { id: 1, employee: 'Sarah Connor', department: 'Design', tasks: 42, score: 98, rating: 4.8, status: 'Top Performer' },
        { id: 2, employee: 'Michael Chen', department: 'Design', tasks: 45, score: 95, rating: 4.5, status: 'Top Performer' },
        { id: 3, employee: 'David Smith', department: 'Management', tasks: 28, score: 94, rating: 4.6, status: 'On Track' },
        { id: 4, employee: 'Alex Jones', department: 'Engineering', tasks: 12, score: 65, rating: 3.2, status: 'Needs Impr.' }
      ]
    };
  }

  if (loading && !data) {
    return <div className={styles.container}>Loading Team Analytics...</div>;
  }

  if (!data) return null;
  const { kpis, leaderboards, productivityTrend, teamComparison, performanceDistribution, drillDownRecords } = data;

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.sectionTitle}>Team Performance Analytics</h2>
          <div className={styles.sectionDesc}>Track productivity, task completion, and team efficiency leaderboards.</div>
        </div>
        
        {/* Filters */}
        <div className={styles.filtersRow}>
          <select name="department" className={styles.filterSelect} onChange={handleFilterChange} value={filters.department}>
            <option value="All">All Departments</option>
            <option value="Design">Design</option>
            <option value="Engineering">Engineering</option>
            <option value="Management">Management</option>
          </select>
          <select name="role" className={styles.filterSelect} onChange={handleFilterChange} value={filters.role}>
            <option value="All">All Roles</option>
            <option value="Designer">Designer</option>
            <option value="Project Manager">Project Manager</option>
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
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Tasks Completed</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-success)' }}>{kpis.tasksCompleted}</div>
          <div className={styles.kpiSub}>Successfully delivered</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Tasks Pending</span></div>
          <div className={styles.kpiValue}>{kpis.tasksPending}</div>
          <div className={styles.kpiSub}>In progress or queued</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Tasks Overdue</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-danger)' }}>{kpis.tasksOverdue}</div>
          <div className={styles.kpiSub}>Past deadline</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Avg Completion</span></div>
          <div className={styles.kpiValue}>{kpis.avgCompletionTime}d</div>
          <div className={styles.kpiSub}>Time per task</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Productivity Score</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-primary)' }}>{kpis.productivityScore}%</div>
          <div className={styles.kpiSub}>Output vs Capacity</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Quality Score</span></div>
          <div className={styles.kpiValue}>{kpis.qualityScore}%</div>
          <div className={styles.kpiSub}>Based on peer review</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Attendance Impact</span></div>
          <div className={styles.kpiValue}>{kpis.attendanceImpact}%</div>
          <div className={styles.kpiSub}>Presence vs Absences</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Site Visits</span></div>
          <div className={styles.kpiValue}>{kpis.siteVisits}</div>
          <div className={styles.kpiSub}>Total logged visits</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Client Ratings</span></div>
          <div className={styles.kpiValue}>{kpis.clientRatings} / 5</div>
          <div className={styles.kpiSub}>Avg customer satisfaction</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Rework %</span></div>
          <div className={styles.kpiValue} style={{ color: 'var(--color-warning)' }}>{kpis.reworkPercent}%</div>
          <div className={styles.kpiSub}>Tasks requiring revision</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}><span className={styles.kpiLabel}>Efficiency Score</span></div>
          <div className={styles.kpiValue} style={{ color: '#8b5cf6' }}>{kpis.efficiencyScore}%</div>
          <div className={styles.kpiSub}>Overall holistic score</div>
        </div>
      </div>

      {/* Leaderboards */}
      <div className={styles.leaderboardRow}>
        <div className={styles.leaderCard}>
          <div className={styles.leaderTitle}>Best Overall Performer</div>
          <div className={styles.leaderAvatar}>{leaderboards.bestPerformer.avatar || '🏆'}</div>
          <div className={styles.leaderName}>{leaderboards.bestPerformer.name}</div>
          <div className={styles.leaderRole}>{leaderboards.bestPerformer.role}</div>
          <div className={styles.leaderStat}>Score: {leaderboards.bestPerformer.score}%</div>
        </div>
        <div className={styles.leaderCard}>
          <div className={styles.leaderTitle}>Most Productive Designer</div>
          <div className={styles.leaderAvatar}>🎨</div>
          <div className={styles.leaderName}>{leaderboards.mostProductiveDesigner.name}</div>
          <div className={styles.leaderRole}>{leaderboards.mostProductiveDesigner.role}</div>
          <div className={styles.leaderStat}>{leaderboards.mostProductiveDesigner.tasks} Tasks Done</div>
        </div>
        <div className={styles.leaderCard}>
          <div className={styles.leaderTitle}>Best Project Manager</div>
          <div className={styles.leaderAvatar}>📊</div>
          <div className={styles.leaderName}>{leaderboards.bestProjectManager.name}</div>
          <div className={styles.leaderRole}>{leaderboards.bestProjectManager.role}</div>
          <div className={styles.leaderStat}>{leaderboards.bestProjectManager.onTime} On-Time</div>
        </div>
        <div className={styles.leaderCard}>
          <div className={styles.leaderTitle}>Highest Client Rating</div>
          <div className={styles.leaderAvatar}>⭐</div>
          <div className={styles.leaderName}>{leaderboards.highestClientRating.name}</div>
          <div className={styles.leaderRole}>{leaderboards.highestClientRating.role}</div>
          <div className={styles.leaderStat}>{leaderboards.highestClientRating.rating}/5 ({leaderboards.highestClientRating.reviews})</div>
        </div>
      </div>

      <div className={styles.row}>
        {/* Productivity Trend (Line Chart) */}
        <div className={styles.card} style={{ flex: '1 1 50%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Productivity vs Quality Trend</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={productivityTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} domain={[50, 100]} />
                <RechartsTooltip />
                <Legend />
                <Line type="monotone" dataKey="productivity" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} name="Productivity %" />
                <Line type="monotone" dataKey="quality" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} name="Quality %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Performance Distribution (Pie Chart) */}
        <div className={styles.card} style={{ flex: '1 1 20%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Performance Distribution</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={performanceDistribution}
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {performanceDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
        {/* Team Comparison (Bar Chart) */}
        <div className={styles.card} style={{ flex: '1 1 100%' }}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>Department Comparison (Efficiency Score)</div>
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamComparison} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="team" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} domain={[0, 100]} />
                <RechartsTooltip />
                <Bar dataKey="score" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  {teamComparison.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.score > 90 ? '#10b981' : entry.score > 80 ? '#3b82f6' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Drill-down Table */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>Employee Performance Drill-down</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.drillDownTable}>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Tasks Completed</th>
                <th>Perf. Score</th>
                <th>Client Rating</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {drillDownRecords.map((record) => (
                <tr key={record.id}>
                  <td style={{ fontWeight: 600 }}>{record.employee}</td>
                  <td>{record.department}</td>
                  <td>{record.tasks}</td>
                  <td>{record.score}%</td>
                  <td>{record.rating} / 5</td>
                  <td>
                    <span className={`${styles.statusBadge} ${record.status === 'Top Performer' ? styles.statusOptimal : record.status === 'On Track' ? styles.statusOver : styles.statusUnder}`}>
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
