import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLeadAnalytics } from '../../api/analytics';
import { Select, Avatar, Badge, DataTable } from '../../components/ui'
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import styles from './LeadAnalyticsPage.module.css';

/* ── Palette ──────────────────────────────────────────────── */
const ACCENT   = '#E8935A';
const ACCENT2  = '#c15f2e';
const SUCCESS  = '#059669';
const WARNING  = '#D97706';
const INFO     = '#2563EB';
const PURPLE   = '#7C3AED';

const PIE_COLORS = [ACCENT, '#2D6A4F', INFO, PURPLE, '#D97706', '#DC2626'];

const STAGE_COLORS = {
  New:         '#3B82F6',
  Contacted:   '#8B5CF6',
  'Site Visit':'#D946EF',
  Quotation:   '#F59E0B',
  Negotiation: ACCENT,
  Won:         SUCCESS,
};

/* ── Date-range mock multipliers ─────────────────────────── */
function makeMockData(range) {
  const mul = range === '7d' ? 0.25 : range === '30d' ? 1 : range === '90d' ? 2.8 : 9;

  const total = Math.round(145 * mul);
  const won   = Math.round(42  * mul);

  const weeks = range === '7d' ? 1 : range === '30d' ? 4 : range === '90d' ? 13 : 52;
  const trendBase = [30, 35, 40, 40, 45, 42, 50, 55, 48, 60, 62, 58];
  const weeklyData = Array.from({ length: weeks }, (_, i) => ({
    week: weeks <= 4 ? `Week ${i + 1}` : weeks <= 13 ? `Wk ${i + 1}` : `W${i + 1}`,
    created: Math.round((trendBase[i % trendBase.length] || 40) * (mul / 4)),
    won:     Math.round(((trendBase[i % trendBase.length] || 40) * (mul / 4)) * 0.29),
  }));

  return {
    kpis: {
      total:    { val: total, trend: 12 },
      won:      { val: won,   trend: 5 },
      convRate: { val: `${((won / total) * 100).toFixed(1)}%`, trend: 2.1 },
      avgScore: { val: 76,    trend: -3 },
    },
    weeklyData,
    stageData: [
      { stage: 'New',         count: Math.round(145 * mul) },
      { stage: 'Contacted',   count: Math.round(110 * mul) },
      { stage: 'Site Visit',  count: Math.round(85  * mul) },
      { stage: 'Quotation',   count: Math.round(60  * mul) },
      { stage: 'Negotiation', count: Math.round(50  * mul) },
      { stage: 'Won',         count: Math.round(42  * mul) },
    ],
    sourceData: [
      { name: 'Facebook',  count: Math.round(65 * mul) },
      { name: 'IndiaMART', count: Math.round(45 * mul) },
      { name: 'Referral',  count: Math.round(20 * mul) },
      { name: 'Website',   count: Math.round(10 * mul) },
      { name: 'Direct',    count: Math.round(5  * mul) },
    ],
    teamData: [
      { id: '1', name: 'Priya Sharma',  assigned: Math.round(60 * mul), won: Math.round(22 * mul), convRate: 36.6, avgScore: 82 },
      { id: '2', name: 'Rahul Desai',   assigned: Math.round(55 * mul), won: Math.round(15 * mul), convRate: 27.2, avgScore: 71 },
      { id: '3', name: 'Amit Kumar',    assigned: Math.round(30 * mul), won: Math.round(5  * mul), convRate: 16.6, avgScore: 65 },
      { id: '4', name: 'Sneha Patil',   assigned: Math.round(40 * mul), won: Math.round(18 * mul), convRate: 45.0, avgScore: 88 },
      { id: '5', name: 'Karan Mehta',   assigned: Math.round(25 * mul), won: Math.round(4  * mul), convRate: 16.0, avgScore: 59 },
    ],
  };
}

/* ── Helpers ──────────────────────────────────────────────── */
function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function TrendBadge({ val }) {
  if (val > 0) return <span className={`${styles.trend} ${styles.trendUp}`}>↑ {val}% vs last period</span>;
  if (val < 0) return <span className={`${styles.trend} ${styles.trendDown}`}>↓ {Math.abs(val)}% vs last period</span>;
  return <span className={`${styles.trend} ${styles.trendNeutral}`}>— No change</span>;
}

function convRateColor(val) {
  if (val >= 30) return SUCCESS;
  if (val >= 15) return WARNING;
  return '#DC2626';
}

function ScoreBadge({ score }) {
  const cls = score >= 70 ? styles.scoreBadgeHigh : score >= 40 ? styles.scoreBadgeMid : styles.scoreBadgeLow;
  return <span className={`${styles.scoreBadge} ${cls}`}>{score}</span>;
}

/* ── Custom Donut Label ───────────────────────────────────── */
function DonutLabel({ cx, cy, total }) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
      <tspan x={cx} dy="-6" style={{ fontSize: 22, fontWeight: 700, fill: 'var(--color-text)' }}>{total}</tspan>
      <tspan x={cx} dy="20" style={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}>Leads</tspan>
    </text>
  );
}

/* ── Custom Tooltip ───────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className={styles.tooltip}>
      {label && <div className={styles.tooltipLabel}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ background: p.color }} />
          <span className={styles.tooltipName}>{p.name}</span>
          <span className={styles.tooltipVal}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

/* ── Skeleton ────────────────────────────────────────────── */
function Skeleton({ className }) {
  return <div className={`${styles.skeleton} ${className || ''}`} />;
}

const DATE_RANGES = [
  { label: '7D',  value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
  { label: '1Y',  value: '1y' },
];

/* ═══════════════════════════════════════════════════════════ */
export default function LeadAnalyticsPage() {
  usePageTitle('Lead Analytics');
  useBreadcrumbs([{ label: 'Analytics' }, { label: 'Leads' }]);
  const [dateRange, setDateRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    setLoading(true);
    setData(null);

    const rangeToParams = {
      '7d':  { from: new Date(Date.now() - 7  * 86400000).toISOString() },
      '30d': { from: new Date(Date.now() - 30 * 86400000).toISOString() },
      '90d': { from: new Date(Date.now() - 90 * 86400000).toISOString() },
      '1y':  { from: new Date(Date.now() - 365* 86400000).toISOString() },
    };

    getLeadAnalytics(rangeToParams[dateRange])
      .then(res => {
        const raw = res.data?.data || {};
        const stageData  = (raw.stageDistribution  || []).map(s => ({ stage: s.stageName, count: s.count }));
        const sourceData = (raw.sourceBreakdown     || []).map(s => ({ name: s.source, count: s.count }));
        const teamData   = (raw.teamPerformance     || []).map((t, i) => ({
          id: t.userId,
          name: t.name,
          assigned: t.totalLeads,
          won: t.wonLeads,
          convRate: t.totalLeads > 0 ? +((t.wonLeads / t.totalLeads) * 100).toFixed(1) : 0,
          avgScore: t.avgScore,
        }));
        const weeklyData = (raw.timeSeries || []).map((w, i) => ({
          week: `W${i + 1}`,
          created: w.count,
          won: w.wonCount,
        }));

        const total  = stageData.reduce((a, s) => a + s.count, 0);
        const wonRow = stageData.find(s => s.stage?.toLowerCase().includes('won'));
        const won    = wonRow?.count || 0;

        if (stageData.length === 0 && sourceData.length === 0) {
          setData(makeMockData(dateRange));
        } else {
          setData({
            kpis: {
              total:    { val: total, trend: 0 },
              won:      { val: won,   trend: 0 },
              convRate: { val: total > 0 ? `${((won / total) * 100).toFixed(1)}%` : '0%', trend: 0 },
              avgScore: { val: teamData.length ? Math.round(teamData.reduce((a,t)=>a+t.avgScore,0)/teamData.length) : 0, trend: 0 },
            },
            weeklyData: weeklyData.length ? weeklyData : makeMockData(dateRange).weeklyData,
            stageData:  stageData.length  ? stageData  : makeMockData(dateRange).stageData,
            sourceData: sourceData.length ? sourceData : makeMockData(dateRange).sourceData,
            teamData:   teamData.length   ? teamData   : makeMockData(dateRange).teamData,
          });
        }
      })
      .catch(() => setData(makeMockData(dateRange)))
      .finally(() => setLoading(false));
  }, [dateRange]);

  const totalSources = data?.sourceData.reduce((a, d) => a + d.count, 0) || 0;

  /* ── Skeleton Screen ── */
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Lead Analytics</h1>
            <p className={styles.desc}>Track pipeline health and conversion metrics.</p>
          </div>
          <div className={styles.rangePills}>
            {DATE_RANGES.map(r => (
              <button key={r.value} className={`${styles.rangePill} ${dateRange === r.value ? styles.rangePillActive : ''}`} onClick={() => setDateRange(r.value)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.kpiStrip}>
          <Skeleton className={styles.skeletonKpi} />
          <Skeleton className={styles.skeletonKpi} />
          <Skeleton className={styles.skeletonKpi} />
          <Skeleton className={styles.skeletonKpi} />
        </div>
        <div className={styles.chartsRow}>
          <Skeleton className={styles.skeletonChart} />
          <Skeleton className={styles.skeletonChart} />
        </div>
        <Skeleton className={styles.skeletonArea} />
        <Skeleton className={styles.skeletonTable} />
      </div>
    );
  }

  return (
    <div className={styles.page}>

      {/* ── Page Header ── */}
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Lead Analytics</h1>
          <p className={styles.desc}>Track pipeline health and conversion metrics.</p>
        </div>
        <div className={styles.rangePills}>
          {DATE_RANGES.map(r => (
            <button
              key={r.value}
              className={`${styles.rangePill} ${dateRange === r.value ? styles.rangePillActive : ''}`}
              onClick={() => setDateRange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrap} style={{ background: 'rgba(232,147,90,0.12)' }}>
            <span className={styles.kpiIcon} style={{ color: ACCENT }}>◈</span>
          </div>
          <div className={styles.kpiBody}>
            <div className={styles.kpiLabel}>Total Leads</div>
            <div className={styles.kpiValue}>{data.kpis.total.val}</div>
            <TrendBadge val={data.kpis.total.trend} />
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrap} style={{ background: 'rgba(5,150,105,0.12)' }}>
            <span className={styles.kpiIcon} style={{ color: SUCCESS }}>✓</span>
          </div>
          <div className={styles.kpiBody}>
            <div className={styles.kpiLabel}>Won This Period</div>
            <div className={styles.kpiValue} style={{ color: SUCCESS }}>{data.kpis.won.val}</div>
            <TrendBadge val={data.kpis.won.trend} />
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrap} style={{ background: 'rgba(37,99,235,0.12)' }}>
            <span className={styles.kpiIcon} style={{ color: INFO }}>%</span>
          </div>
          <div className={styles.kpiBody}>
            <div className={styles.kpiLabel}>Conversion Rate</div>
            <div className={styles.kpiValue} style={{ color: INFO }}>{data.kpis.convRate.val}</div>
            <TrendBadge val={data.kpis.convRate.trend} />
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrap} style={{ background: 'rgba(124,58,237,0.12)' }}>
            <span className={styles.kpiIcon} style={{ color: PURPLE }}>★</span>
          </div>
          <div className={styles.kpiBody}>
            <div className={styles.kpiLabel}>Avg Lead Score</div>
            <div className={styles.kpiValue} style={{ color: PURPLE }}>{data.kpis.avgScore.val}</div>
            <TrendBadge val={data.kpis.avgScore.trend} />
          </div>
        </div>
      </div>

      {/* ── Two Charts Side-by-Side ── */}
      <div className={styles.chartsRow}>

        {/* Stage Distribution Bar Chart */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span>Stage Distribution</span>
            <span className={styles.cardSubtitle}>Leads per stage</span>
          </div>
          <div className={styles.chartArea}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.stageData}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 0, bottom: 4 }}
                barSize={20}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="stage"
                  width={88}
                  tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-surface-2)' }} />
                <Bar dataKey="count" name="Leads" radius={[0, 4, 4, 0]}>
                  {data.stageData.map((d, i) => (
                    <Cell key={i} fill={STAGE_COLORS[d.stage] || ACCENT} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Source Breakdown Donut */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span>Source Breakdown</span>
            <span className={styles.cardSubtitle}>Where leads come from</span>
          </div>
          <div className={styles.donutWrap}>
            <PieChart width={200} height={200}>
              <Pie
                data={data.sourceData}
                cx={100}
                cy={100}
                innerRadius={62}
                outerRadius={88}
                paddingAngle={3}
                dataKey="count"
                stroke="none"
                startAngle={90}
                endAngle={-270}
              >
                {data.sourceData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
            <div className={styles.donutCenter}>
              <span className={styles.donutTotal}>{totalSources}</span>
              <span className={styles.donutLabel}>Total</span>
            </div>
          </div>
          <div className={styles.pieLegend}>
            {data.sourceData.map((d, i) => (
              <div key={i} className={styles.pieLegendRow}>
                <div className={styles.pieLegendLeft}>
                  <span className={styles.pieDot} style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className={styles.pieName}>{d.name}</span>
                </div>
                <div className={styles.pieLegendRight}>
                  <span className={styles.pieCount}>{d.count}</span>
                  <span className={styles.piePct}>
                    {totalSources ? `${((d.count / totalSources) * 100).toFixed(1)}%` : '0%'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Lead Creation Trend (Area Chart) ── */}
      <div className={`${styles.card} ${styles.cardFullWidth}`}>
        <div className={styles.cardHeader}>
          <span>Lead Creation Trend</span>
          <div className={styles.trendLegend}>
            <span className={styles.trendDot} style={{ background: ACCENT }} /> New Leads
            <span className={styles.trendDot} style={{ background: SUCCESS }} /> Won
          </div>
        </div>
        <div className={styles.areaChartArea}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data.weeklyData}
              margin={{ top: 10, right: 24, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="gradWon" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SUCCESS} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={SUCCESS} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="created"
                name="New Leads"
                stroke={ACCENT}
                strokeWidth={2.5}
                fill="url(#gradCreated)"
                dot={false}
                activeDot={{ r: 5, fill: ACCENT, stroke: '#fff', strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="won"
                name="Won"
                stroke={SUCCESS}
                strokeWidth={2.5}
                fill="url(#gradWon)"
                dot={false}
                activeDot={{ r: 5, fill: SUCCESS, stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Team Performance Table ── */}
      <div className={`${styles.card} ${styles.cardFullWidth}`}>
        <div className={styles.cardHeader}>
          <span>Team Performance</span>
          <span className={styles.cardSubtitle}>Ranked by conversion rate</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Rank</th>
                <th className={styles.th}>Team Member</th>
                <th className={styles.th} style={{ textAlign: 'right' }}>Assigned</th>
                <th className={styles.th} style={{ textAlign: 'right' }}>Won</th>
                <th className={styles.th} style={{ textAlign: 'right' }}>Conv. Rate</th>
                <th className={styles.th} style={{ textAlign: 'right' }}>Avg Score</th>
                <th className={styles.th}>Performance</th>
              </tr>
            </thead>
            <tbody>
              {[...data.teamData]
                .sort((a, b) => b.convRate - a.convRate)
                .map((row, i) => {
                  const convRate = row.convRate;
                  const barWidth = Math.min(100, (row.won / (row.assigned || 1)) * 100);
                  return (
                    <tr key={row.id} className={styles.tr}>
                      <td className={styles.td}>
                        <span className={`${styles.rankBadge} ${i === 0 ? styles.rankGold : i === 1 ? styles.rankSilver : i === 2 ? styles.rankBronze : ''}`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className={styles.td}>
                        <div className={styles.memberCell}>
                          <div className={styles.memberAvatar}>{getInitials(row.name)}</div>
                          <span className={styles.memberName}>{row.name}</span>
                        </div>
                      </td>
                      <td className={styles.td} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {row.assigned}
                      </td>
                      <td className={styles.td} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: SUCCESS, fontWeight: 600 }}>
                        {row.won}
                      </td>
                      <td className={styles.td} style={{ textAlign: 'right' }}>
                        <span style={{ color: convRateColor(convRate), fontWeight: 700 }}>{convRate}%</span>
                      </td>
                      <td className={styles.td} style={{ textAlign: 'right' }}>
                        <ScoreBadge score={row.avgScore} />
                      </td>
                      <td className={styles.td}>
                        <div className={styles.perfBarBg}>
                          <div
                            className={styles.perfBarFill}
                            style={{
                              width: `${barWidth}%`,
                              background: i === 0 ? ACCENT : i === 1 ? '#8B5CF6' : '#3B82F6',
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
