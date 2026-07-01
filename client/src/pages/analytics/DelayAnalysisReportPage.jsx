import { useState, useEffect } from 'react';
import { Select } from '../../components/ui';
import styles from './DelayAnalysisReportPage.module.css';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import api from '../../api/axios';
import {
  PieChart, Pie, Cell,
  BarChart, Bar,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';

const ACCENT = '#e11d48';
const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#64748b'];

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
  );
}

const DATE_RANGES = [
  { key: '30D', label: 'Last 30 Days' },
  { key: '90D', label: 'Last 90 Days' },
  { key: '1Y', label: 'Last Year' },
  { key: 'ALL', label: 'All Time' },
];

export default function DelayAnalysisReportPage() {
  usePageTitle('Delay Analysis Report');
  useBreadcrumbs([{ label: 'Analytics' }, { label: 'Delay Analysis' }]);

  const [period, setPeriod] = useState('90D');
  const [data, setData] = useState({
    totalDelayImpact: 0,
    frequencyByCause: [],
    durationByType: [],
    trendByMonth: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchDelays = async () => {
      try {
        setLoading(true);
        let queryPeriod = period.toLowerCase();
        if (queryPeriod === 'all') queryPeriod = '3650d';
        const res = await api.get(`/api/analytics/projects/delay-analysis?period=${queryPeriod}`);
        if (isMounted && res.data.success) {
          setData(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load delay analytics:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchDelays();
    return () => { isMounted = false; };
  }, [period]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className={styles.tooltip}>
        <div className={styles.tooltipLabel}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} className={styles.tooltipRow}>
            <span style={{ color: p.color }}>●</span>
            <span>{p.name}: <strong>{p.value} days</strong></span>
          </div>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0];
    return (
      <div className={styles.tooltip}>
        <span style={{ color: d.payload.fill }}>● </span>
        {d.name}: <strong>{d.value} occurrences</strong>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.filters}>
        <div style={{ width: 200 }}>
          <Select
            options={DATE_RANGES}
            value={DATE_RANGES.find(o => o.key === period)}
            onChange={(opt) => setPeriod(opt.key)}
            placeholder="Select Period"
          />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading delay analytics...</div>
      ) : (
        <>
          <div className={styles.kpiGrid}>
            <KpiCard
              label="Total Delay Impact"
              value={`${data.totalDelayImpact} Days`}
              sub="Cumulative delay duration"
              accentColor={ACCENT}
              icon="⏱"
            />
            <KpiCard
              label="Most Frequent Cause"
              value={data.frequencyByCause.length ? data.frequencyByCause.reduce((max, obj) => obj.count > max.count ? obj : max, data.frequencyByCause[0]).name : '—'}
              sub="Based on schedule revisions"
              icon="⚠️"
            />
            <KpiCard
              label="Avg Delay Duration"
              value={`${data.durationByType.length ? Math.round(data.durationByType.reduce((sum, o) => sum + o.avgDays, 0) / data.durationByType.length) : 0} Days`}
              sub="Across all project types"
              icon="📅"
            />
          </div>

          <div className={styles.chartsGrid}>
            {/* Frequency by Cause */}
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Delay Frequency by Cause</h3>
              <p className={styles.chartDesc}>Number of delays categorized by root cause.</p>
              <div style={{ width: '100%', height: 300 }}>
                {data.frequencyByCause.length > 0 ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={data.frequencyByCause}
                        cx="50%" cy="50%"
                        innerRadius={60} outerRadius={100}
                        paddingAngle={2}
                        dataKey="count"
                        nameKey="name"
                      >
                        {data.frequencyByCause.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                    No delay data available.
                  </div>
                )}
              </div>
            </div>

            {/* Average Duration by Project Type */}
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Avg Delay Duration by Project Type</h3>
              <p className={styles.chartDesc}>Which types of projects experience the longest delays.</p>
              <div style={{ width: '100%', height: 300 }}>
                {data.durationByType.length > 0 ? (
                  <ResponsiveContainer>
                    <BarChart data={data.durationByType} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                      <XAxis dataKey="type" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="avgDays" name="Avg Delay (Days)" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                    No delay data available.
                  </div>
                )}
              </div>
            </div>

            {/* Delay Trends */}
            <div className={styles.chartCardFull}>
              <h3 className={styles.chartTitle}>Delay Trends Over Time</h3>
              <p className={styles.chartDesc}>Total days of delay recorded per month.</p>
              <div style={{ width: '100%', height: 350 }}>
                {data.trendByMonth.length > 0 ? (
                  <ResponsiveContainer>
                    <AreaChart data={data.trendByMonth} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorDelay" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={ACCENT} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                      <XAxis dataKey="month" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="delayDays" name="Delay (Days)" stroke={ACCENT} fillOpacity={1} fill="url(#colorDelay)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                    No delay data available.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
