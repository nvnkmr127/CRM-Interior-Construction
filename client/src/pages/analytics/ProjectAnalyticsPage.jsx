/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProjectAnalytics } from '../../api/analytics'
import styles from './ProjectAnalyticsPage.module.css'
import { Select, Badge, DataTable, Avatar } from '../../components/ui'
import { usePageTitle } from '../../hooks/usePageTitle'
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs'

import GlobalFilterBar from '../../components/analytics/GlobalFilterBar'
import { AnalyticsFilterProvider } from '../../context/AnalyticsFilterContext'
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts'

/* ─── Design constants ──────────────────────────────────────────────── */
const ACCENT = '#E8935A'
const STATUS_COLORS = {
  active: '#2563EB',
  on_hold: '#D97706',
  completed: '#059669',
  cancelled: '#9CA3AF',
}

/* ─── Default Empty Data ─────────────────────────────────────────────── */
function getEmptyData() {
  return {
    kpis: {
      active: 0,
      revenue: 0,
      onTimeRate: 0,
      avgDuration: 0,
    },
    revenueData: [],
    statusData: [],
    topProjects: [],
    delayedProjects: [],
    retrospectives: [],
  }
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
function formatLakhs(val) {
  if (val === null || val === undefined) return '—'
  if (val >= 100) return `₹${(val / 100).toFixed(2)} Cr`
  return `₹${val}L`
}

function KpiCard({ label, value, sub, accentColor, icon, onClick }) {
  return (
    <div 
      className={styles.kpiCard} 
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className={styles.kpiTop}>
        <span className={styles.kpiLabel}>{label}</span>
        {icon && <span className={styles.kpiIcon} style={{ color: accentColor }}>{icon}</span>}
      </div>
      <div className={styles.kpiValue} style={{ color: accentColor || 'var(--color-text)' }}>{value}</div>
      {sub && <div className={styles.kpiSub}>{sub}</div>}
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} className={styles.tooltipRow}>
          <span style={{ color: p.color }}>●</span>
          <span>{p.name}: <strong>{formatLakhs(p.value)}</strong></span>
        </div>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0]
  return (
    <div className={styles.tooltip}>
      <span style={{ color: d.payload.fill }}>● </span>
      {d.name}: <strong>{d.value}</strong>
    </div>
  )
}

const DATE_RANGES = [
  { key: '7D', label: '7D' },
  { key: '30D', label: '30D' },
  { key: '90D', label: '90D' },
  { key: '1Y', label: '1Y' },
  { key: 'ALL', label: 'ALL' },
]

/* ─── Component ──────────────────────────────────────────────────────── */
export default function ProjectAnalyticsPage() {
  usePageTitle('Project Analytics')
  useBreadcrumbs([{ label: 'Analytics' }, { label: 'Projects' }])

  const navigate = useNavigate()
  const [dateRange, setDateRange] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  useEffect(() => {
    setLoading(true)

    const rangeToParams = {
      '7D':  { from: new Date(Date.now() - 7   * 86400000).toISOString() },
      '30D': { from: new Date(Date.now() - 30  * 86400000).toISOString() },
      '90D': { from: new Date(Date.now() - 90  * 86400000).toISOString() },
      '1Y':  { from: new Date(Date.now() - 365 * 86400000).toISOString() },
    }

    getProjectAnalytics(rangeToParams[dateRange])
      .then(res => {
        const raw = res || {}
        const statusData    = (raw.statusDistribution || []).map(s => {
          const statusStr = s.status || 'unknown';
          return {
            name: statusStr.charAt(0).toUpperCase() + statusStr.slice(1).replace('_', ' '),
            count: s.count,
            id: statusStr.toLowerCase(),
          };
        })
        const revenueData   = (raw.revenueTimeline   || []).map(r => ({
          month: r.month || 'Unknown',
          planned: (r.planned || 0) / 100000,
          collected: (r.collected || 0) / 100000,
        }))
        const delayedProjects = (raw.delayedProjects || []).map(p => ({
          id: p.id,
          name: p.name,
          pm: p.pm_name || '—',
          targetDate: p.target_date ? new Date(p.target_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—',
          daysDelayed: p.days_delayed,
          status: p.status,
        }))
        const topProjects   = (raw.topProjects       || []).map(p => ({
          id: p.id,
          name: p.name,
          value: p.value / 100000,
          status: p.status,
        }))
        const retrospectives = raw.allRetrospectives || []

        if (statusData.length === 0 && revenueData.length === 0 && retrospectives.length === 0) {
          setData(getEmptyData())
        } else {
          const totalProjects = statusData.reduce((s, d) => s + d.count, 0)
          setData({
            kpis: {
              active: statusData.filter(s => !['completed', 'cancelled', 'on_hold', 'deleted'].includes(s.id)).reduce((sum, s) => sum + s.count, 0),
              revenue: topProjects.reduce((a, b) => a + b.value, 0),
              onTimeRate: 100 - (delayedProjects.length > 0 ? Math.round((delayedProjects.length / (totalProjects || 1)) * 100) : 0),
              avgDuration: 0,
            },
            revenueData,
            statusData,
            topProjects,
            delayedProjects,
            retrospectives,
          })
        }
      })
      .catch((err) => {
        console.error('Project Analytics Fetch Error:', err.response?.data || err);
        setData({ ...getEmptyData(), debugError: err.response?.data?.error || err.message });
      })
      .finally(() => setLoading(false))
  }, [dateRange])

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-500">Loading analytics...</div>
  }

  if (data?.debugError) {
    return <div className="p-8 text-red-500 bg-red-100 rounded">Error from API: {data.debugError}</div>
  }

  const totalProjects = data ? data.statusData.reduce((s, d) => s + d.count, 0) : 0

  const pageContent = (
    <div className={styles.pageContainer}>
      {/* ── Global Filters ────────────────────────────────────────────── */}
      <GlobalFilterBar />

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className={styles.headerRow}>
            <div>
              <h1 className={styles.title}>Project Analytics</h1>
              <div className={styles.desc}>Monitor project health, delivery, and revenue performance.</div>
            </div>

        <div className={styles.dateRangePills}>
          {DATE_RANGES.map(r => (
            <button
              key={r.key}
              className={`${styles.rangePill} ${dateRange === r.key ? styles.rangePillActive : ''}`}
              onClick={() => setDateRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Strip ────────────────────────────────────────────────── */}
      <div className={styles.kpiStrip}>
        <KpiCard
          label="Active Projects"
          value={data.kpis.active}
          sub="Currently running"
          accentColor="var(--color-info)"
          icon="◈"
          onClick={() => navigate('/projects?status=active')}
        />
        <KpiCard
          label="Revenue Collected"
          value={formatLakhs(data.kpis.revenue)}
          sub={`Period: ${dateRange}`}
          accentColor={ACCENT}
          icon="₹"
        />
        <KpiCard
          label="On-Time Rate"
          value={`${data.kpis.onTimeRate}%`}
          sub="Projects on schedule"
          accentColor="var(--color-success)"
          icon="✓"
        />
        <KpiCard
          label="Avg. Duration"
          value={data.kpis.avgDuration}
          sub="days per project"
          accentColor="var(--color-text)"
          icon="◷"
        />
      </div>

      {/* ── Charts Row ───────────────────────────────────────────────── */}
      <div className={styles.chartsRow}>
        {/* Area chart — Planned vs Collected */}
        <div className={styles.card} style={{ flex: '0 0 calc(60% - var(--space-3))' }}>
          <div className={styles.cardHeader}>
            <span>Revenue: Planned vs Collected</span>
            <span className={styles.cardSubLabel}>(₹ Lakhs)</span>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data?.revenueData || []} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ACCENT} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradPlanned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9CA3AF" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#9CA3AF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={v => `₹${v}L`}
                  tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: 16, fontSize: 13 }}
                  formatter={(value) => <span style={{ color: 'var(--color-text-secondary)' }}>{value}</span>}
                />
                <Area
                  type="monotone"
                  dataKey="planned"
                  stroke="#9CA3AF"
                  strokeWidth={2}
                  fill="url(#gradPlanned)"
                  name="Planned"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
                <Area
                  type="monotone"
                  dataKey="collected"
                  stroke={ACCENT}
                  strokeWidth={2.5}
                  fill="url(#gradCollected)"
                  name="Collected"
                  dot={false}
                  activeDot={{ r: 5, fill: ACCENT, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut — Status breakdown */}
        <div className={styles.card} style={{ flex: '1 1 0', minWidth: 200 }}>
          <div className={styles.cardHeader}>
            <span>Project Status</span>
          </div>
          <div className={styles.donutWrap}>
            <div className={styles.donutContainer}>
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie
                    data={data.statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="count"
                    stroke="none"
                    onClick={(entry) => navigate(`/projects?status=${entry.id || (entry.payload && entry.payload.id)}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    {data.statusData.map((entry) => (
                      <Cell key={entry.id} fill={STATUS_COLORS[entry.id]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.donutCenter}>
                <div className={styles.donutVal}>{totalProjects}</div>
                <div className={styles.donutLabel}>Total</div>
              </div>
            </div>
            <div className={styles.pieLegend}>
              {data.statusData.map(d => (
                <div key={d.id} className={styles.pieLegendItem}>
                  <span className={styles.pieDot} style={{ background: STATUS_COLORS[d.id] }} />
                  <span className={styles.pieLegendName}>{d.name}</span>
                  <span className={styles.pieLegendCount}>{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Top Projects Horizontal Bar ───────────────────────────────── */}
      <div className={styles.card} style={{ marginBottom: 'var(--space-6)' }}>
        <div className={styles.cardHeader}>
          <span>Top 5 Projects by Value</span>
          <span className={styles.cardSubLabel}>(₹ Lakhs)</span>
        </div>
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data.topProjects}
              layout="vertical"
              margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={v => `₹${v}L`}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={170}
                tick={{ fontSize: 12, fill: 'var(--color-text)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => [formatLakhs(v), 'Project Value']}
                contentStyle={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  boxShadow: 'var(--shadow-md)',
                  fontSize: 13,
                }}
              />
              <Bar
                dataKey="value"
                fill={ACCENT}
                radius={[0, 6, 6, 0]}
                barSize={20}
                label={{ position: 'right', formatter: v => `₹${v}L`, fontSize: 11, fill: 'var(--color-text-secondary)' }}
                onClick={(entry) => {
                  if (entry.id || (entry.payload && entry.payload.id)) {
                    navigate(`/projects/${entry.id || entry.payload.id}`);
                  }
                }}
                style={{ cursor: 'pointer' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Delayed Projects Table ────────────────────────────────────── */}
      <div className={styles.tableCard}>
        <div className={styles.tableHeaderRow}>
          <div 
            className={styles.tableTitle} 
            onClick={() => navigate('/projects?status=overdue')}
            style={{ cursor: 'pointer' }}
          >
            <span className={styles.tableTitleDot} />
            Delayed Projects
          </div>
          <span className={styles.tableCount}>{data.delayedProjects.length} project{data.delayedProjects.length !== 1 ? 's' : ''} overdue</span>
        </div>

        {data.delayedProjects.length === 0 ? (
          <div className={styles.noDelays}>
            <span style={{ fontSize: 28 }}>✓</span>
            <span>All projects are on track!</span>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Project</th>
                  <th className={styles.th}>Client</th>
                  <th className={styles.th}>PM</th>
                  <th className={styles.th}>Days Overdue</th>
                  <th className={styles.th}>Phase</th>
                  <th className={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {[...data.delayedProjects].sort((a, b) => b.overdue - a.overdue).map(row => (
                  <tr key={row.id} className={styles.tr}>
                    <td className={styles.td}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{row.name}</span>
                    </td>
                    <td className={styles.td} style={{ color: 'var(--color-text-secondary)' }}>{row.client}</td>
                    <td className={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className={styles.pmAvatar}>{row.pm.charAt(0)}</div>
                        <span style={{ fontSize: 'var(--text-sm)' }}>{row.pm}</span>
                      </div>
                    </td>
                    <td className={styles.td}>
                      <span className={`${styles.overdueBadge} ${row.overdue > 10 ? styles.overdueBadgeDanger : styles.overdueBadgeWarn}`}>
                        {row.overdue} days
                      </span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.phaseTag}>{row.phase}</span>
                    </td>
                    <td className={styles.td}>
                      <button
                        className={styles.escalateBtn}
                        onClick={() => navigate(`/projects/${row.id}`)}
                      >
                        Escalate →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Global Retrospectives & Lessons Learned Dashboard ─────────────────── */}
      <div className={styles.tableCard} style={{ marginTop: 'var(--space-6)' }}>
        <div className={styles.tableHeaderRow}>
          <div>
            <div className={styles.tableTitle}>
              <span className={styles.tableTitleDot} style={{ background: '#8B5CF6' }} />
              💡 Global Retrospectives & Lessons Learned
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Central repository of project learnings, process recommendations, and past challenges.
            </div>
          </div>
          <span className={styles.tableCount}>
            {(data.retrospectives || []).length} Recorded Retrospective{(data.retrospectives || []).length !== 1 ? 's' : ''}
          </span>
        </div>

        {(!data.retrospectives || data.retrospectives.length === 0) ? (
          <div className={styles.noDelays} style={{ padding: 'var(--space-8)' }}>
            <span style={{ fontSize: 28 }}>💡</span>
            <span>No project retrospectives recorded yet. Complete project retrospectives under project details to populate global insights!</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
            {data.retrospectives.map((retro, index) => (
              <div 
                key={retro.id || index} 
                style={{ 
                  background: 'var(--color-surface-2)', 
                  borderRadius: 'var(--radius-md)', 
                  border: '1px solid var(--color-border)',
                  padding: 'var(--space-4)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-2)' }}>
                  <div>
                    <strong style={{ fontSize: 'var(--text-base)', color: 'var(--color-text)' }}>{retro.project_name}</strong>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginLeft: 8 }}>
                      • PM: {retro.pm_name}
                    </span>
                  </div>
                  <button
                    className={styles.escalateBtn}
                    onClick={() => navigate(`/projects/${retro.project_id}?tab=Retrospective`)}
                  >
                    View Project Retro →
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-3)' }}>
                  {retro.what_went_well && (
                    <div style={{ background: 'rgba(5, 150, 105, 0.08)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #059669' }}>
                      <strong style={{ color: '#059669', fontSize: 'var(--text-xs)', display: 'block', marginBottom: 4 }}>
                        ✓ WHAT WENT WELL
                      </strong>
                      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>{retro.what_went_well}</p>
                    </div>
                  )}

                  {retro.what_went_wrong && (
                    <div style={{ background: 'rgba(225, 29, 72, 0.08)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #E11D48' }}>
                      <strong style={{ color: '#E11D48', fontSize: 'var(--text-xs)', display: 'block', marginBottom: 4 }}>
                        ⚠ WHAT WENT WRONG / BOTTLENECKS
                      </strong>
                      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>{retro.what_went_wrong}</p>
                    </div>
                  )}

                  {retro.design_feedback && (
                    <div style={{ background: 'rgba(37, 99, 235, 0.08)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #2563EB' }}>
                      <strong style={{ color: '#2563EB', fontSize: 'var(--text-xs)', display: 'block', marginBottom: 4 }}>
                        ✏ DESIGN & DRAWING FEEDBACK
                      </strong>
                      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>{retro.design_feedback}</p>
                    </div>
                  )}

                  {retro.process_changes && (
                    <div style={{ background: 'rgba(217, 119, 6, 0.08)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #D97706' }}>
                      <strong style={{ color: '#D97706', fontSize: 'var(--text-xs)', display: 'block', marginBottom: 4 }}>
                        ⚙ RECOMMENDED PROCESS CHANGES
                      </strong>
                      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>{retro.process_changes}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <AnalyticsFilterProvider>
      {pageContent}
    </AnalyticsFilterProvider>
  )
}

















