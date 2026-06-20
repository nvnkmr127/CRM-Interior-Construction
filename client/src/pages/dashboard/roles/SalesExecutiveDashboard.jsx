import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../store/authContext';
import api from '../../../api/axios';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid
} from 'recharts';
import { Skeleton } from '../../../components/ui';
import ErrorBoundary from '../../../components/ErrorBoundary';
import styles from '../DashboardPage.module.css';

import { LeadAgingWidget } from '../../../components/dashboard/widgets/LeadAgingWidget';
import { AIPriorityLeadsWidget } from '../../../components/dashboard/widgets/AIPriorityLeadsWidget';
import { OverdueFollowUpWidget } from '../../../components/dashboard/widgets/OverdueFollowUpWidget';
import { RevenuePipelineWidget } from '../../../components/dashboard/widgets/RevenuePipelineWidget';

/* ── Static sparkline data (one series per KPI) ───────────────────────── */
const sparkLeads   = [22,28,31,35,38,36,40,39,41,40,42,42].map((v,i) => ({ i, v }));
const sparkRevenue = [8,9,10,11,10,12,11,13,12,13,14,14].map((v,i) => ({ i, v }));
const sparkProjects= [7,8,8,9,10,10,11,11,12,11,12,12].map((v,i) => ({ i, v }));
const sparkTasks   = [6,8,10,12,9,11,14,13,15,14,15,15].map((v,i) => ({ i, v }));

/* ── Revenue trend (12-week rolling) ─────────────────────────────────── */
const revenueTrend = [
  { week: 'W1',  amt: 8.2 },  { week: 'W2',  amt: 9.1 },
  { week: 'W3',  amt: 7.8 },  { week: 'W4',  amt: 10.4 },
  { week: 'W5',  amt: 11.2 }, { week: 'W6',  amt: 10.0 },
  { week: 'W7',  amt: 12.1 }, { week: 'W8',  amt: 11.5 },
  { week: 'W9',  amt: 13.2 }, { week: 'W10', amt: 12.8 },
  { week: 'W11', amt: 13.9 }, { week: 'W12', amt: 14.2 },
];

/* ── Helpers ──────────────────────────────────────────────────────────── */
function getHour() { return new Date().getHours(); }
function greeting() {
  const h = getHour();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function avatarColor(name) {
  const palette = [
    ['#E8935A', '#C4813E'],
    ['#3B82F6', '#1D4ED8'],
    ['#8B5CF6', '#6D28D9'],
    ['#10B981', '#059669'],
    ['#EC4899', '#BE185D'],
  ];
  const idx = name.charCodeAt(0) % palette.length;
  return palette[idx];
}

/* ── Mini sparkline component ─────────────────────────────────────────── */
function Spark({ data, color }) {
  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#sg-${color.replace('#','')})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Custom pie legend ────────────────────────────────────────────────── */
function PipeLegend({ pipeline }) {
  const total = pipeline.reduce((s, p) => s + p.count, 0);
  return (
    <div className={styles.pipeLegend}>
      {pipeline.map(p => (
        <div key={p.id} className={styles.pipeLegendRow}>
          <span className={styles.pipeLegendDot} style={{ background: p.color }} />
          <span className={styles.pipeLegendName}>{p.name}</span>
          <span className={styles.pipeLegendCount}>{p.count}</span>
          <span className={styles.pipeLegendPct}>{Math.round((p.count / total) * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

/* ── Custom revenue tooltip ───────────────────────────────────────────── */
function RevTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.revTooltip}>
      <div className={styles.revTooltipLabel}>{label}</div>
      <div className={styles.revTooltipVal}>₹{payload[0].value}L</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
export default function SalesExecutiveDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading]   = useState(true);
  const [period,  setPeriod]    = useState('30D');
  const [stats,   setStats]     = useState(null);
  const [activity,setActivity]  = useState(null);
  const [pipeline,setPipeline]  = useState(null);
  const [tasks,   setTasks]     = useState(null);
  const [payments,setPayments]  = useState(null);

  useEffect(() => {
    const PIPE_COLORS = ['#3B82F6','#8B5CF6','#F59E0B','#EC4899','#10B981','#059669','#E8935A'];

    const formatRevenue = (val) => {
      const n = Number(val || 0);
      if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
      return `₹${n.toLocaleString('en-IN')}`;
    };

    const formatDue = (d) => d ? new Date(d).toISOString().split('T')[0] : '—';
    const isOverdue = (d) => d && new Date(d) < new Date();

    Promise.allSettled([
      api.get('/dashboard/stats'),
      api.get('/dashboard/activity'),
      api.get('/dashboard/pipeline'),
      api.get('/tasks', { params: { assigneeId: 'me', limit: 5, status: 'todo,in_progress' } }),
      api.get('/dashboard/payments-due'),
    ]).then(([statsR, actR, analyticsR, tasksR, paymentsR]) => {
      // Stats
      if (statsR.status === 'fulfilled') {
        const s = statsR.value.data?.data || {};
        setStats({
          activeLeads:    { val: s.activeLeads?.count  ?? 0, trend: s.activeLeads?.trend    ?? 0 },
          wonMonth:       { val: formatRevenue(s.wonThisMonth?.value), trend: 0 },
          activeProjects: { val: s.activeProjects?.count ?? 0, overdue: s.activeProjects?.overdueCount ?? 0 },
          tasksDueToday:  { val: s.tasksDueToday?.count  ?? 0, overdue: s.tasksDueToday?.overdueCount  ?? 0 },
          targets:        { 
            targetRevenue: s.salesTargets?.targetRevenue ?? 0, 
            targetLeads: s.salesTargets?.targetLeads ?? 0,
            actualRevenue: s.wonThisMonth?.value ?? 0,
            actualLeads: s.activeLeads?.count ?? 0
          }
        });
      } else {
        setStats({
          activeLeads:    { val: 0, trend: 0 },
          wonMonth:       { val: '₹0', trend: 0 },
          activeProjects: { val: 0, overdue: 0 },
          tasksDueToday:  { val: 0, overdue: 0 },
          targets:        { targetRevenue: 0, targetLeads: 0, actualRevenue: 0, actualLeads: 0 }
        });
      }

      // Activity
      if (actR.status === 'fulfilled') {
        const rawData = actR.value.data?.data;
        const rows = Array.isArray(rawData) ? rawData : [];
        const timeAgo = (d) => {
          const diff = Date.now() - new Date(d).getTime();
          const mins = Math.floor(diff / 60000);
          if (mins < 60) return `${mins}m ago`;
          const hrs = Math.floor(mins / 60);
          if (hrs < 24) return `${hrs}h ago`;
          return `${Math.floor(hrs / 24)}d ago`;
        };
        setActivity(rows.map((r, i) => ({
          id: r.id || i,
          user: r.user_name || 'System',
          action: r.action || 'updated',
          text: `${r.entity} ${r.entity_id ? `#${r.entity_id.slice(0,6)}` : ''}`,
          time: timeAgo(r.created_at),
        })));
      } else {
        setActivity([]);
      }

      // Pipeline from analytics
      if (analyticsR.status === 'fulfilled') {
        const rawStages = analyticsR.value.data?.data;
        const stages = Array.isArray(rawStages) ? rawStages : [];
        setPipeline(stages.map((s, i) => ({
          id: s.id || i,
          name: s.name,
          count: parseInt(s.count, 10),
          color: PIPE_COLORS[i % PIPE_COLORS.length],
        })));
      } else {
        setPipeline([]);
      }

      // My tasks
      if (tasksR.status === 'fulfilled') {
        const rawData = tasksR.value.data?.data;
        const raw = Array.isArray(rawData) ? rawData : [];
        const today = new Date().toISOString().split('T')[0];
        setTasks(raw.slice(0, 5).map(t => ({
          id: t.id,
          title: t.title,
          project: t.project_name || '—',
          due: formatDue(t.due_date),
          overdue: isOverdue(t.due_date),
          done: t.status === 'done',
          priority: t.priority || 'medium',
        })));
      } else {
        setTasks([]);
      }

      // Payments due
      if (paymentsR.status === 'fulfilled') {
        const rawData = paymentsR.value.data?.data;
        const raw = Array.isArray(rawData) ? rawData : [];
        setPayments(raw.map(p => ({
          id: p.id,
          project: p.project_name || '—',
          milestone: p.title || '—',
          amount: p.amount >= 100000 ? `₹${(p.amount / 100000).toFixed(1)}L` : `₹${Number(p.amount).toLocaleString('en-IN')}`,
          due: formatDue(p.due_date),
          overdue: isOverdue(p.due_date),
        })));
      } else {
        setPayments([]);
      }

      setLoading(false);
    });
  }, []);

  const handleTaskToggle = (id) => {
    setTasks(prev => (prev || []).map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const priorityColor = { urgent: 'var(--color-danger)', high: 'var(--color-warning)', low: 'var(--color-text-muted)' };

  const verbClass = { moved: styles.verbInfo, uploaded: styles.verbAccent, logged: styles.verbSuccess, created: styles.verbAccent };

  /* ── KPI card data ──────────────────────────────────────────────────── */
  const kpiCards = stats ? [
    {
      label:   'Active Leads',
      value:   stats.activeLeads.val,
      trend:   stats.activeLeads.trend,
      spark:   sparkLeads,
      color:   '#3B82F6',
      suffix:  null,
      sub:     null,
    },
    {
      label:   'Revenue This Month',
      value:   stats.wonMonth.val,
      trend:   stats.wonMonth.trend,
      spark:   sparkRevenue,
      color:   '#E8935A',
      suffix:  null,
      sub:     null,
    },
    {
      label:   'Active Projects',
      value:   stats.activeProjects.val,
      trend:   null,
      spark:   sparkProjects,
      color:   '#8B5CF6',
      suffix:  null,
      sub:     stats.activeProjects.overdue > 0 ? `${stats.activeProjects.overdue} overdue` : null,
      subDanger: true,
    },
    {
      label:   'Tasks Due',
      value:   stats.tasksDueToday.val,
      trend:   null,
      spark:   sparkTasks,
      color:   '#F59E0B',
      suffix:  null,
      sub:     stats.tasksDueToday.overdue > 0 ? `${stats.tasksDueToday.overdue} overdue` : null,
      subDanger: true,
    },
  ] : [];

  /* ═══════════════════════════ RENDER ══════════════════════════════════ */
  return (
    <div className={styles.page}>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.greeting}>{greeting()}, {user?.name?.split(' ')[0] || 'there'}</h1>
          <p className={styles.dateText}>{today}</p>
        </div>

        <div className={styles.timePills}>
          {['7D', '30D', '90D'].map(p => (
            <button
              key={p}
              className={`${styles.timePill} ${period === p ? styles.timePillActive : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>

        <div className={styles.headerRight}>
          <button className={styles.btnSecondary} onClick={() => navigate('/leads')}>
            + Lead
          </button>
          <button className={styles.btnPrimary} onClick={() => navigate('/projects')}>
            + Project
          </button>
        </div>
      </div>

      {/* ── KPI GRID ───────────────────────────────────────────────────── */}
      <ErrorBoundary>
        <div className={styles.kpiGrid}>
        {loading
          ? Array(4).fill(0).map((_, i) => (
              <div key={i} className={styles.kpiCard}>
                <Skeleton height="12px" width="60%" />
                <Skeleton height="36px" width="50%" />
                <Skeleton height="12px" width="40%" />
                <div className={styles.kpiSpark}><Skeleton height="48px" width="100%" /></div>
              </div>
            ))
          : kpiCards.map((k, i) => (
              <div key={i} className={styles.kpiCard}>
                <div className={styles.kpiLabel}>{k.label}</div>
                <div className={styles.kpiValue}>{k.value}</div>
                {k.trend !== null && k.trend !== undefined ? (
                  <div className={k.trend >= 0 ? styles.kpiTrendUp : styles.kpiTrendDown}>
                    {k.trend >= 0 ? '↑' : '↓'} {Math.abs(k.trend)}%
                  </div>
                ) : k.sub ? (
                  <div className={k.subDanger ? styles.kpiTrendDown : styles.kpiTrendUp}>
                    {k.sub}
                  </div>
                ) : null}
                <div className={styles.kpiSpark}>
                  <Spark data={k.spark} color={k.color} />
                </div>
              </div>
            ))
        }
        </div>
      </ErrorBoundary>

      {/* ── MIDDLE ROW ─────────────────────────────────────────────────── */}
      <ErrorBoundary>
        <div className={styles.midRow}>

        {/* Revenue Trend chart */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Revenue Trend</span>
            <span className={styles.cardPeriodBadge}>{period}</span>
          </div>
          <div className={styles.revChartWrap}>
            {loading ? (
              <Skeleton height="220px" width="100%" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenueTrend} margin={{ top: 12, right: 16, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#E8935A" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#E8935A" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 11, fill: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}
                    axisLine={false}
                    tickLine={false}
                    dy={6}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => `₹${v}L`}
                    width={42}
                  />
                  <Tooltip content={<RevTooltip />} cursor={{ stroke: 'var(--color-border-strong)', strokeWidth: 1, strokeDasharray: '4 2' }} />
                  <Area
                    type="monotone"
                    dataKey="amt"
                    stroke="#E8935A"
                    strokeWidth={2}
                    fill="url(#revGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#E8935A', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Lead Pipeline donut */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Lead Pipeline</span>
            <a href="/leads" className={styles.viewAll} onClick={e => { e.preventDefault(); navigate('/leads'); }}>View all</a>
          </div>
          <div className={styles.pipeChartWrap}>
            {loading ? (
              <>
                <Skeleton height="160px" width="160px" style={{ borderRadius: '50%', margin: '0 auto' }} />
                <div style={{ marginTop: 16 }}>{Array(5).fill(0).map((_, i) => <Skeleton key={i} height="14px" width="100%" style={{ marginBottom: 6 }} />)}</div>
              </>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie
                      data={pipeline}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {pipeline.map((p, i) => <Cell key={i} fill={p.color} />)}
                    </Pie>
                    <Tooltip
                      formatter={(val, name) => [`${val} leads`, name]}
                      contentStyle={{
                        fontSize: 12,
                        fontFamily: 'var(--font-sans)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-md)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <PipeLegend pipeline={pipeline} />
              </>
            )}
          </div>
        </div>

        {/* Targets vs Actuals */}
        {stats?.targets && (stats.targets.targetRevenue > 0 || stats.targets.targetLeads > 0) && (
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>Sales Targets</span>
              <span className={styles.cardPeriodBadge}>This Month</span>
            </div>
            <div className={styles.cardBody} style={{ paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Revenue (₹{stats.targets.actualRevenue}L / ₹{stats.targets.targetRevenue}L)</span>
                  <span style={{ fontWeight: 500 }}>{stats.targets.targetRevenue > 0 ? Math.min(100, Math.round((stats.targets.actualRevenue / stats.targets.targetRevenue) * 100)) : 0}%</span>
                </div>
                <div style={{ height: 8, background: 'var(--color-bg-alt)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${stats.targets.targetRevenue > 0 ? Math.min(100, (stats.targets.actualRevenue / stats.targets.targetRevenue) * 100) : 0}%`, background: 'var(--color-primary)' }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Active Leads ({stats.targets.actualLeads} / {stats.targets.targetLeads})</span>
                  <span style={{ fontWeight: 500 }}>{stats.targets.targetLeads > 0 ? Math.min(100, Math.round((stats.targets.actualLeads / stats.targets.targetLeads) * 100)) : 0}%</span>
                </div>
                <div style={{ height: 8, background: 'var(--color-bg-alt)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${stats.targets.targetLeads > 0 ? Math.min(100, (stats.targets.actualLeads / stats.targets.targetLeads) * 100) : 0}%`, background: 'var(--color-accent)' }} />
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </ErrorBoundary>

      {/* ── NEW WIDGETS ROW ─────────────────────────────────────────────────── */}
      <ErrorBoundary>
        <div className={styles.botRow} style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
           <AIPriorityLeadsWidget />
           <OverdueFollowUpWidget />
           <LeadAgingWidget />
        </div>
      </ErrorBoundary>

      {/* ── BOTTOM ROW ─────────────────────────────────────────────────── */}
      <ErrorBoundary>
        <div className={styles.botRow}>

        {/* Recent Activity */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Recent Activity</span>
            <a href="/activity" className={styles.viewAll} onClick={e => { e.preventDefault(); }}>View all</a>
          </div>
          <div className={styles.cardBody}>
            {loading
              ? Array(4).fill(0).map((_, i) => (
                  <div key={i} className={styles.actRow}>
                    <Skeleton height="32px" width="32px" style={{ borderRadius: '50%', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <Skeleton height="13px" width="80%" />
                      <Skeleton height="11px" width="40%" style={{ marginTop: 4 }} />
                    </div>
                  </div>
                ))
              : activity?.map(act => {
                  const [c1, c2] = avatarColor(act.user);
                  return (
                    <div key={act.id} className={styles.actRow}>
                      <div
                        className={styles.actAvatar}
                        style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
                      >
                        {act.user.charAt(0)}
                      </div>
                      <div className={styles.actContent}>
                        <span className={styles.actName}>{act.user}</span>
                        {' '}
                        <span className={verbClass[act.action] || styles.verbInfo}>{act.action}</span>
                        {' '}{act.text}
                        <div className={styles.actTime}>{act.time}</div>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        </div>

        {/* My Tasks */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>My Tasks</span>
            <a href="/tasks" className={styles.viewAll} onClick={e => { e.preventDefault(); navigate('/tasks'); }}>View all</a>
          </div>
          <div className={styles.cardBody}>
            {loading
              ? Array(4).fill(0).map((_, i) => (
                  <div key={i} className={styles.taskRow}>
                    <Skeleton height="8px" width="8px" style={{ borderRadius: '50%', flexShrink: 0, marginTop: 5 }} />
                    <div style={{ flex: 1 }}>
                      <Skeleton height="13px" width="75%" />
                      <Skeleton height="11px" width="50%" style={{ marginTop: 4 }} />
                    </div>
                  </div>
                ))
              : tasks?.map(task => (
                  <div
                    key={task.id}
                    className={`${styles.taskRow} ${task.done ? styles.taskRowDone : ''}`}
                    onClick={() => handleTaskToggle(task.id)}
                  >
                    <span
                      className={styles.taskDot}
                      style={{ background: priorityColor[task.priority] || 'var(--color-text-muted)' }}
                    />
                    <div className={styles.taskBody}>
                      <div className={styles.taskTitle} style={{ textDecoration: task.done ? 'line-through' : 'none' }}>
                        {task.title}
                      </div>
                      <div className={styles.taskMeta}>
                        <span className={styles.taskProject}>{task.project}</span>
                        <span className={`${styles.taskDate} ${task.overdue && !task.done ? styles.taskDateOverdue : ''}`}>
                          {task.overdue && !task.done ? 'Overdue · ' : ''}{task.due}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
            }
          </div>
        </div>

        {/* Payments Due */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Payments Due</span>
            <a href="/payments" className={styles.viewAll} onClick={e => { e.preventDefault(); }}>View all</a>
          </div>
          <div className={styles.cardBody}>
            {loading
              ? Array(3).fill(0).map((_, i) => (
                  <div key={i} className={styles.payRow}>
                    <Skeleton height="13px" width="65%" />
                    <Skeleton height="11px" width="80%" style={{ marginTop: 4 }} />
                  </div>
                ))
              : payments?.map(pay => (
                  <div key={pay.id} className={`${styles.payRow} ${pay.overdue ? styles.payOverdue : ''}`}>
                    <div className={styles.payTop}>
                      <span className={styles.payProject}>{pay.project}</span>
                      <span className={styles.payAmount}>{pay.amount}</span>
                    </div>
                    <div className={styles.payBot}>
                      <span className={styles.payMilestone}>{pay.milestone}</span>
                      <span className={`${styles.payDate} ${pay.overdue ? styles.payDateOverdue : ''}`}>
                        {pay.overdue ? 'Overdue · ' : ''}{pay.due}
                      </span>
                    </div>
                  </div>
                ))
            }
          </div>
        </div>

        </div>
      </ErrorBoundary>
    </div>
  );
}
