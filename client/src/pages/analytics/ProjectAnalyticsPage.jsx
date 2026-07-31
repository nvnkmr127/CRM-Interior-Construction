/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProjectAnalytics } from '../../api/analytics'
import styles from './ProjectAnalyticsPage.module.css'
import { Select, Badge, DataTable, Avatar } from '../../components/ui'
import { usePageTitle } from '../../hooks/usePageTitle'
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs'
import TimelineAnalytics from '../../components/analytics/TimelineAnalytics'
import ResourceAnalytics from '../../components/analytics/ResourceAnalytics'
import TeamAnalytics from '../../components/analytics/TeamAnalytics'
import TaskAnalytics from '../../components/analytics/TaskAnalytics'
import QualityAnalytics from '../../components/analytics/QualityAnalytics'
import SiteProgressAnalytics from '../../components/analytics/SiteProgressAnalytics'
import DelayAnalytics from '../../components/analytics/DelayAnalytics'
import ClientAnalytics from '../../components/analytics/ClientAnalytics'
import RiskAnalytics from '../../components/analytics/RiskAnalytics'

import ExecutiveAnalytics from '../../components/analytics/ExecutiveAnalytics'
import AIForecastAnalytics from '../../components/analytics/AIForecastAnalytics'
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
  }
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
function formatLakhs(val) {
  if (val === null || val === undefined) return '—'
  if (val >= 100) return `₹${(val / 100).toFixed(2)} Cr`
  return `₹${val}L`
}

function KpiCard({ label, value, sub, accentColor, icon }) {
  return (
    <div className={styles.kpiCard}>
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
]

/* ─── Component ──────────────────────────────────────────────────────── */
export default function ProjectAnalyticsPage() {
  usePageTitle('Project Analytics')
  useBreadcrumbs([{ label: 'Analytics' }, { label: 'Projects' }])

  const navigate = useNavigate()
  const [dateRange, setDateRange] = useState('1Y')
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
        const raw = res.data?.data || {}
        const statusData    = (raw.statusDistribution || []).map(s => ({
          name: s.status.charAt(0).toUpperCase() + s.status.slice(1).replace('_', ' '),
          count: s.count,
          id: s.status,
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
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Delayed Projects Table ────────────────────────────────────── */}
      <div className={styles.tableCard}>
        <div className={styles.tableHeaderRow}>
          <div className={styles.tableTitle}>
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

      {/* ── Timeline Analytics Module ────────────────────────────────── */}
      <TimelineAnalytics />

      {/* ── Resource Analytics Module ────────────────────────────────── */}
      <ResourceAnalytics />

      {/* ── Team Performance Analytics Module ────────────────────────── */}
      <TeamAnalytics />

      {/* ── Task Analytics Module ────────────────────────────────────── */}
      <TaskAnalytics />

      {/* ── Quality Analytics Module ─────────────────────────────────── */}
      <QualityAnalytics />

      {/* ── Site Progress Analytics Module ───────────────────────────── */}
      <SiteProgressAnalytics />

      {/* ── Delay Analytics Module ───────────────────────────────────── */}
      <DelayAnalytics />

      {/* ── Client Analytics Module ──────────────────────────────────── */}
      <ClientAnalytics />


      {/* ── Risk Analytics Module ────────────────────────────────────── */}
      <RiskAnalytics />

      {/* ── AI Forecast Analytics Module ─────────────────────────────── */}
      <AIForecastAnalytics />
        </>
      )}
    </div>
  )

  return (
    <AnalyticsFilterProvider>
      {pageContent}
    </AnalyticsFilterProvider>
  )
}

















