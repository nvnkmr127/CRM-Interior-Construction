/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../store/authContext';
import api from '../../../api/axios';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid
} from 'recharts';
import { Skeleton, Modal } from '../../../components/ui';
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

// Revenue trend is now loaded dynamically from API

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
      <AreaChart data={data || []} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
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
  if (!pipeline) return null;
  const total = pipeline.reduce((s, p) => s + p.count, 0);
  return (
    <div className={styles.pipeLegend}>
      {pipeline.map(p => (
        <div key={p.id} className={styles.pipeLegendRow}>
          <span className={styles.pipeLegendDot} style={{ background: p.color }} />
          <span className={styles.pipeLegendName}>{p.name}</span>
          <span className={styles.pipeLegendCount}>{p.count}</span>
          <span className={styles.pipeLegendPct}>{total > 0 ? Math.round((p.count / total) * 100) : 0}%</span>
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

function getActivityDesc(act) {
  if (!act) return <span>No activity details available.</span>;

  const action = (act.action || '').toLowerCase();
  const entity = (act.entity || '').toLowerCase();
  const actor = act.user || 'System';
  const newVal = act.new_value || {};
  const oldVal = act.old_value || {};

  let descriptionText = '';
  let screenName = 'System Dashboard';
  let resourceName = entity ? entity.replace('_', ' ') : 'Resource';

  // Use pre-formatted message if present from mock or audit log details
  const detailMsg = newVal.message || newVal.description || null;

  // 1. Lead Stage Changed
  if (action === 'lead.stage_changed' || action.includes('stage')) {
    let leadName = act.lead_name || newVal.leadName || newVal.name;
    if (!leadName && act.entity_id) {
      try {
        const mockDb = JSON.parse(localStorage.getItem('mock_db') || '{}');
        const lead = (mockDb.leads || []).find(l => String(l.id) === String(act.entity_id));
        if (lead) leadName = lead.name;
      } catch (e) {}
    }
    if (!leadName) leadName = 'Lead';
    const stage = newVal.stageName || newVal.stage_name || 'New Stage';
    descriptionText = detailMsg ? `${actor} updated lead stage of "${leadName}": ${detailMsg}` : `${actor} updated lead stage: changed lead "${leadName}" stage to "${stage}"`;
    screenName = 'Leads CRM';
  }
  // 2. Converted Lead to Project
  else if (action === 'lead.converted' || action.includes('convert')) {
    let leadName = act.lead_name || newVal.leadName || newVal.name;
    if (!leadName && act.entity_id) {
      try {
        const mockDb = JSON.parse(localStorage.getItem('mock_db') || '{}');
        const lead = (mockDb.leads || []).find(l => String(l.id) === String(act.entity_id));
        if (lead) leadName = lead.name;
      } catch (e) {}
    }
    if (!leadName) leadName = 'Lead';
    descriptionText = detailMsg ? `${actor} converted lead "${leadName}": ${detailMsg}` : `${actor} converted lead "${leadName}" to project`;
    screenName = 'Lead Conversion Modal';
  }
  // 3. Added New Team Member
  else if (action === 'user.created' || (action.includes('create') && entity === 'user')) {
    const userName = newVal.name || newVal.email || 'New Team Member';
    descriptionText = detailMsg ? `${actor} added team member: ${detailMsg}` : `${actor} added new team member: "${userName}"`;
    screenName = 'User Management';
  }
  // 4. Role Changed
  else if (action === 'user.role_updated' || action === 'user.role_changed' || action.includes('role')) {
    const userName = newVal.userName || newVal.name || 'Team Member';
    const oldRole = newVal.oldRole || newVal.old_role || 'Designer';
    const newRole = newVal.newRole || newVal.new_role || 'Sales';
    descriptionText = detailMsg ? `${actor} updated role: ${detailMsg}` : `${actor} changed role of "${userName}" from "${oldRole}" to "${newRole}"`;
    screenName = 'User Management -> Roles';
  }
  // 5. Task Created / Updated Status
  else if (action === 'task.created') {
    const title = newVal.title || 'Task';
    descriptionText = `${actor} created task: "${title}"`;
    screenName = 'Tasks Board';
  } else if (action === 'task.status_changed' || action.includes('status')) {
    const title = newVal.title || 'Task';
    const status = newVal.status || 'updated';
    descriptionText = `${actor} updated task status: changed task "${title}" to "${status}"`;
    screenName = 'Tasks Board';
  }
  // Fallbacks for other specific actions
  else {
    const cleanAction = action.replace('_', ' ').replace('.', ' ');
    const cleanEntity = entity.replace('_', ' ');
    const idText = act.entity_id ? ` #${String(act.entity_id).slice(0, 8)}` : '';
    descriptionText = `${actor} completed action "${cleanAction}" on ${cleanEntity}${idText}`;
    screenName = entity ? `${entity.charAt(0).toUpperCase() + entity.slice(1)} Screen` : 'System Dashboard';
  }

  const changes = [];
  const payload = newVal.body || newVal;
  const oldPayload = oldVal?.body || oldVal || {};

  if (payload && typeof payload === 'object') {
    for (const key of Object.keys(payload)) {
      if (['id', 'tenant_id', 'created_at', 'updated_at', 'deleted_at', 'password', 'token', 'path', 'body', 'leadName', 'stageName', 'userName', 'oldRole', 'newRole', 'title', 'status', 'message', 'type', 'notes'].includes(key)) continue;
      const oldValVal = oldPayload[key];
      const newValVal = payload[key];
      
      const oldValStr = oldValVal !== undefined && oldValVal !== null ? (typeof oldValVal === 'object' ? JSON.stringify(oldValVal) : String(oldValVal)) : null;
      const newValStr = newValVal !== undefined && newValVal !== null ? (typeof newValVal === 'object' ? JSON.stringify(newValVal) : String(newValVal)) : null;
      
      if (newValStr !== null && oldValStr !== newValStr) {
        if (oldValStr !== null) {
          changes.push({ key, from: oldValStr, to: newValStr });
        } else {
          changes.push({ key, to: newValStr });
        }
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', color: '#1e293b' }}>
      <div style={{ fontSize: '1rem', lineHeight: 1.4, color: '#0f172a' }}>
        {descriptionText}.
      </div>
      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
        <strong>Screen/Tab:</strong> {screenName}
      </div>
      {changes.length > 0 && (
        <div style={{ marginTop: '4px' }}>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px', color: '#64748b' }}>
            Modified Fields:
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {changes.map((c, idx) => (
              <li key={idx} style={{ listStyleType: 'disc' }}>
                <span style={{ fontWeight: 600 }}>{c.key}</span>:{' '}
                {c.from !== undefined ? (
                  <>
                    changed from <code style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.8rem' }}>{c.from}</code> to{' '}
                  </>
                ) : (
                  'set to '
                )}
                <code style={{ background: '#dcfce7', color: '#166534', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.8rem' }}>{c.to}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
      {changes.length === 0 && (act.new_value?.message || act.new_value?.description) && (
        <div style={{ fontSize: '0.85rem', marginTop: '4px', color: '#475569' }}>
          <strong>Details:</strong> {act.new_value.message || act.new_value.description}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
export default function SalesExecutiveDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading]   = useState(true);
  const [period,  setPeriod]    = useState('All');
  const [startDate, setStartDate] = useState('2026-08-01');
  const [endDate, setEndDate]   = useState('2026-08-15');
  const [stats,   setStats]     = useState(null);
  const [activity,setActivity]  = useState(null);
  const [pipeline,setPipeline]  = useState(null);
  const [tasks,   setTasks]     = useState(null);
  const [payments,setPayments]  = useState(null);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [handovers, setHandovers] = useState([]);
  const [syncCounter, setSyncCounter] = useState(0);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [leadsData, setLeadsData] = useState([]);

  useEffect(() => {
    const handleDbChange = () => setSyncCounter(c => c + 1);
    window.addEventListener('app:mock-db-change', handleDbChange);
    return () => window.removeEventListener('app:mock-db-change', handleDbChange);
  }, []);

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
       api.get('/dashboard/stats', { params: { period, startDate, endDate } }),
       api.get('/dashboard/activity'),
       api.get('/dashboard/pipeline', { params: { period, startDate, endDate } }),
       api.get('/tasks', { params: { assigneeId: 'me', limit: 5, status: 'todo,in_progress' } }),
       api.get('/dashboard/payments-due'),
       api.get('/projects'),
       api.get('/leads')
     ]).then(([statsR, actR, analyticsR, tasksR, paymentsR, projectsR, leadsR]) => {
      // Stats
      if (statsR.status === 'fulfilled') {
        const s = statsR.value.data?.data || {};
        setStats({
          activeLeads:    { val: s.activeLeads?.count  ?? 0, trend: s.activeLeads?.trend    ?? 0 },
          wonMonth:       { val: formatRevenue(s.wonThisMonth?.value), trend: s.wonThisMonth?.trend ?? 15 },
          activeProjects: { val: s.activeProjects?.count ?? 0, overdue: s.activeProjects?.overdueCount ?? 0 },
          tasksDueToday:  { val: s.tasksDueToday?.count  ?? 0, overdue: s.tasksDueToday?.overdueCount  ?? 0 },
          targets:        { 
            targetRevenue: s.salesTargets?.targetRevenue ?? 0, 
            targetLeads: s.salesTargets?.targetLeads ?? 0,
            actualRevenue: s.wonThisMonth?.value ?? 0,
            actualLeads: s.activeLeads?.count ?? 0
          }
        });
        setRevenueTrend(s.revenueTrend || []);
      } else {
        setStats({
          activeLeads:    { val: 0, trend: 0 },
          wonMonth:       { val: '₹0', trend: 0 },
          activeProjects: { val: 0, overdue: 0 },
          tasksDueToday:  { val: 0, overdue: 0 },
          targets:        { targetRevenue: 0, targetLeads: 0, actualRevenue: 0, actualLeads: 0 }
        });
        setRevenueTrend([]);
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
        const sortedRows = [...rows].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        const filteredRows = sortedRows.filter(r => {
          const action = (r.action || r.type || '').toLowerCase();
          return action.startsWith('lead.') || action.startsWith('task.') || action.startsWith('project.') || action.startsWith('user.') ||
                 action.includes('stage') || action.includes('convert') || action.includes('role') || action.includes('member');
        });
        setActivity(filteredRows.map((r, i) => ({
          id: r.id || i,
          user: r.user_name || 'System',
          action: r.action || r.type || 'updated',
          text: r.notes || r.title || `${r.entity || 'System'} ${r.entity_id ? '#' + String(r.entity_id).slice(0,6) : ''}`,
          time: timeAgo(r.created_at),
          created_at: r.created_at,
          entity: r.entity || (r.lead_id ? 'lead' : r.project_id ? 'project' : null),
          entity_id: r.entity_id || r.lead_id || r.project_id,
          lead_name: r.lead_name,
          project_name: r.project_name,
          new_value: r.new_value || { message: r.notes || r.title, type: r.type, title: r.title },
          old_value: r.old_value,
          ip_address: r.ip_address,
          browser: r.browser,
          device: r.device,
          location: r.location,
          reason: r.reason
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

      // Handovers (Projects)
      if (projectsR.status === 'fulfilled') {
        const rawData = projectsR.value.data?.data;
        const list = Array.isArray(rawData) ? rawData : [];
        const myHandovers = list.filter(p => {
          const s = p.status?.toLowerCase();
          const isActive = !s || s === 'active' || !['on_hold', 'completed', 'overdue', 'cancelled', 'deleted', 'pending_payment'].includes(s);
          if (!isActive) return false;

          return p.sales_rep_id === user?.id || 
                 p.sales_rep_name === user?.name || 
                 (user?.name && p.sales_rep_name && p.sales_rep_name.toLowerCase().includes(user.name.split(' ')[0].toLowerCase()));
        });
        setHandovers(myHandovers);
      } else {
        setHandovers([]);
      }

      // Leads
      if (leadsR.status === 'fulfilled') {
        const rawLeads = leadsR.value.data?.data;
        const lList = Array.isArray(rawLeads) ? rawLeads : (rawLeads?.leads || []);
        setLeadsData(lList);
      } else {
        setLeadsData([]);
      }

      setLoading(false);
    });
  }, [syncCounter, period, startDate, endDate]);

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

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div className={styles.timePills}>
            {['All', '7D', '30D', '90D', 'Custom'].map(p => (
              <button
                key={p}
                className={`${styles.timePill} ${period === p ? styles.timePillActive : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>

          {period === 'Custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-full)', padding: '4px 14px', border: '1px solid var(--color-border)' }}>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text)', fontSize: '0.8rem', outline: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>to</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text)', fontSize: '0.8rem', outline: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              />
            </div>
          )}
        </div>

        <div className={styles.headerRight}>
          <button className={styles.btnPrimary} onClick={() => navigate('/leads?new=true')}>
            + Lead
          </button>
          <button className={styles.btnPrimary} onClick={() => navigate('/projects?new=true')}>
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
                <AreaChart data={revenueTrend || []} margin={{ top: 12, right: 16, left: -10, bottom: 0 }}>
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
            <div className={styles.cardBody} style={{ padding: '0 1.25rem 1.25rem 1.25rem', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Revenue Target Box */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>Revenue Target</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      ₹{(stats.targets.actualRevenue / 100000).toFixed(1)}L reached of ₹{(stats.targets.targetRevenue / 100000).toFixed(1)}L target
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      border: '1px solid',
                      background: 'rgba(16, 185, 129, 0.1)',
                      color: 'var(--color-success)',
                      borderColor: 'rgba(16, 185, 129, 0.2)'
                    }}>
                      {stats.targets.targetRevenue > 0 ? Math.round((stats.targets.actualRevenue / stats.targets.targetRevenue) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <div style={{ height: 6, background: 'var(--color-bg-alt)', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
                  <div style={{ height: '100%', width: `${stats.targets.targetRevenue > 0 ? Math.min(100, (stats.targets.actualRevenue / stats.targets.targetRevenue) * 100) : 0}%`, background: 'var(--color-primary)' }} />
                </div>
              </div>

              {/* Active Leads Target Box */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>Active Leads Target</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      {stats.targets.actualLeads} leads active of {stats.targets.targetLeads} target
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      border: '1px solid',
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--color-info)',
                      borderColor: 'rgba(59, 130, 246, 0.2)'
                    }}>
                      {stats.targets.targetLeads > 0 ? Math.round((stats.targets.actualLeads / stats.targets.targetLeads) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <div style={{ height: 6, background: 'var(--color-bg-alt)', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
                  <div style={{ height: '100%', width: `${stats.targets.targetLeads > 0 ? Math.min(100, (stats.targets.actualLeads / stats.targets.targetLeads) * 100) : 0}%`, background: 'var(--color-accent)' }} />
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </ErrorBoundary>

      {/* ── SALES HANDOVERS ROW ─────────────────────────────────────────────────── */}
      <ErrorBoundary>
        <div className={styles.midRow} style={{ marginTop: '1.5rem', marginBottom: '1.5rem', gridTemplateColumns: '1fr' }}>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>Sales Handovers Pipeline</span>
              <span className={styles.cardPeriodBadge}>Active Projects</span>
            </div>
            <div className={styles.cardBody} style={{ maxHeight: '320px', overflowY: 'auto', padding: '0 1.25rem 1.25rem 1.25rem', paddingTop: '1rem' }}>
              {loading ? (
                <Skeleton height="150px" width="100%" />
              ) : handovers.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {handovers.map(p => (
                    <div 
                      key={p.id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '12px 16px', 
                        borderRadius: '8px', 
                        border: '1px solid var(--color-border)', 
                        background: 'var(--color-surface)',
                        cursor: 'pointer' 
                      }} 
                      onClick={() => navigate(`/projects/${p.id}`)}
                    >
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>{p.name}</h4>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                          PM: <strong style={{color:'var(--color-text)'}}>{p.pm_name || 'Unassigned'}</strong> | Client: {p.client_name}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span 
                          style={{ 
                            display: 'inline-block', 
                            padding: '2px 8px', 
                            borderRadius: '12px', 
                            fontSize: '0.75rem', 
                            fontWeight: 600, 
                            border: '1px solid',
                            background: p.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', 
                            color: p.status === 'active' ? 'var(--color-success)' : 'var(--color-warning)',
                            borderColor: p.status === 'active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'
                          }}
                        >
                          {p.status === 'active' ? 'Active Handover' : 'Pending Payment'}
                        </span>
                        <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)' }}>
                          ₹{Number(p.value || p.contract_value || 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                  No active sales handovers recorded.
                </div>
              )}
            </div>
          </div>
        </div>
      </ErrorBoundary>

      {/* ── NEW WIDGETS ROW ─────────────────────────────────────────────────── */}
      <ErrorBoundary>
        <div className={styles.botRow} style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
           <AIPriorityLeadsWidget 
             leads={(leadsData || [])
               .filter(l => l.status !== 'converted' && l.status !== 'lost')
               .sort((a, b) => (b.score || 0) - (a.score || 0))
               .slice(0, 2)
               .map(l => ({
                 id: l.id,
                 name: l.name,
                 probability: `${l.score || 75}%`,
                 action: l.status === 'new' ? 'Call within 24 hours' : 'Schedule initial consultation'
               }))
             } 
           />
           <OverdueFollowUpWidget 
             items={(leadsData || [])
               .filter(l => l.status !== 'converted' && l.status !== 'lost')
               .map(l => {
                 const diffDays = Math.floor((Date.now() - new Date(l.updated_at || l.created_at).getTime()) / (1000 * 60 * 60 * 24));
                 return {
                   id: l.id,
                   name: l.name,
                   type: l.source ? `Follow up (${l.source})` : 'Call Client',
                   daysOverdue: Math.max(1, diffDays)
                 };
               })
               .slice(0, 2)
             }
           />
           <LeadAgingWidget 
             leads={(leadsData || [])
               .filter(l => l.status !== 'converted' && l.status !== 'lost')
               .map(l => {
                 const diffDays = Math.floor((Date.now() - new Date(l.created_at).getTime()) / (1000 * 60 * 60 * 24));
                 return {
                   id: l.id,
                   name: l.name,
                   age: `${diffDays} days`,
                   stage: l.stage_name || l.status || 'New',
                   value: l.budget_max ? `₹${(l.budget_max / 100000).toFixed(0)}L` : '—'
                 };
               })
               .sort((a, b) => parseInt(b.age) - parseInt(a.age))
               .slice(0, 3)
             }
           />
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
                    <div
                      key={act.id}
                      className={styles.actRow}
                      onClick={() => setSelectedActivity(act)}
                      style={{ cursor: 'pointer' }}
                    >
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

      {selectedActivity && (
        <Modal
          isOpen={!!selectedActivity}
          onClose={() => setSelectedActivity(null)}
          title="Activity Log Details"
          size="md"
        >
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)'
                }}
              >
                {selectedActivity.user.charAt(0)}
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{selectedActivity.user}</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                  Performed action at {new Date(selectedActivity.created_at || Date.now()).toLocaleString()}
                </p>
              </div>
            </div>

            <hr style={{ border: 0, borderTop: '1px solid #e2e8f0', margin: 0 }} />

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
              {getActivityDesc(selectedActivity)}
            </div>

            <hr style={{ border: 0, borderTop: '1px solid #e2e8f0', margin: 0 }} />

             <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px 16px', fontSize: '0.9rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Action:</span>
              <span style={{ textTransform: 'capitalize' }}>
                {selectedActivity.action ? selectedActivity.action.replace('_', ' ').replace('.', ' ') : 'N/A'}
              </span>

              <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Entity Type:</span>
              <span style={{ textTransform: 'capitalize' }}>{selectedActivity.entity || 'N/A'}</span>

              <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Entity ID:</span>
              <span style={{ fontSize: '0.85rem' }}>{selectedActivity.entity_id ? String(selectedActivity.entity_id) : 'N/A'}</span>

              {selectedActivity.ip_address && (
                <>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>IP Address:</span>
                  <span>{selectedActivity.ip_address}</span>
                </>
              )}

              {(selectedActivity.browser || selectedActivity.device) && (
                <>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Client Info:</span>
                  <span>{[selectedActivity.browser, selectedActivity.device].filter(Boolean).join(' / ')}</span>
                </>
              )}

              {selectedActivity.location && (
                <>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Location:</span>
                  <span>{selectedActivity.location}</span>
                </>
              )}

              {selectedActivity.reason && (
                <>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>Reason:</span>
                  <span>{selectedActivity.reason}</span>
                </>
              )}
            </div>

            {selectedActivity.new_value && typeof selectedActivity.new_value === 'object' && 
              Object.keys(selectedActivity.new_value).filter(
                k => !['id', 'tenant_id', 'created_at', 'updated_at', 'deleted_at', 'password', 'token', 'path', 'body', 'leadName', 'stageName', 'userName', 'oldRole', 'newRole', 'title', 'status', 'message', 'type', 'notes', 'lead_name', 'project_name'].includes(k)
              ).length > 0 && (
                <>
                  <hr style={{ border: 0, borderTop: '1px solid #e2e8f0', margin: 0 }} />
                  <div>
                    <h5 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600 }}>Payload / Context Data:</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px 16px', fontSize: '0.85rem' }}>
                      {Object.entries(selectedActivity.new_value)
                        .filter(([key]) => !['id', 'tenant_id', 'created_at', 'updated_at', 'deleted_at', 'password', 'token', 'path', 'body', 'leadName', 'stageName', 'userName', 'oldRole', 'newRole', 'title', 'status', 'message', 'type', 'notes', 'lead_name', 'project_name'].includes(key))
                        .map(([key, val]) => (
                          <React.Fragment key={key}>
                            <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>{key.replace('_', ' ')}:</span>
                            <span>{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                          </React.Fragment>
                        ))}
                    </div>
                  </div>
                </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              {selectedActivity.entity && selectedActivity.entity_id && (
                <button
                  onClick={() => {
                    const ent = selectedActivity.entity.toLowerCase();
                    setSelectedActivity(null);
                    if (ent === 'project') {
                      navigate(`/projects/${selectedActivity.entity_id}`);
                    } else if (ent === 'lead') {
                      navigate(`/leads`);
                    } else if (ent === 'task') {
                      navigate(`/tasks`);
                    } else {
                      navigate(`/projects`);
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#e8935a',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    transition: 'opacity 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.opacity = 0.9}
                  onMouseOut={(e) => e.target.style.opacity = 1}
                >
                  Go to {selectedActivity.entity}
                </button>
              )}
              <button
                onClick={() => setSelectedActivity(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: 'white',
                  color: '#475569',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
