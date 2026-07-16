/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect, no-useless-assignment */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import WidgetContainer from '../../components/analytics/WidgetContainer';
import WidgetLibraryModal from '../../components/analytics/WidgetLibraryModal';
import RemoveWidgetModal from '../../components/analytics/RemoveWidgetModal';
import CustomDateModal from '../../components/analytics/CustomDateModal';
import { getLeadAnalytics, getRevenueAnalytics } from '../../api/analytics';
import { Select, Avatar, Badge, Modal } from '../../components/ui'
import AnalyticsDrillDownModal from '../../components/analytics/AnalyticsDrillDownModal';
import ReportingCenterModal from '../../components/analytics/ReportingCenterModal';
import AnalyticsAlertsPanel from '../../components/analytics/AnalyticsAlertsPanel';
import GoalTrackingWidget from '../../components/analytics/GoalTrackingWidget';
import LeadToProjectOutcomesWidget from '../../components/analytics/LeadToProjectOutcomesWidget';
import LeadKPIsWidget from '../../components/analytics/LeadKPIsWidget';
import RevenueKPIsWidget from '../../components/analytics/RevenueKPIsWidget';
import RevenueChartsWidget from '../../components/analytics/RevenueChartsWidget';
import SalesCycleWidget from '../../components/analytics/SalesCycleWidget';
import PipelineVelocityWidget from '../../components/analytics/PipelineVelocityWidget';
import SLADashboardWidget from '../../components/analytics/SLADashboardWidget';
import AIRevenueInsightsWidget from '../../components/analytics/AIRevenueInsightsWidget';
import AIPredictionWidget from '../../components/analytics/AIPredictionWidget';
import SalesProductivityWidget from '../../components/analytics/SalesProductivityWidget';
import MarketingAnalyticsWidget from '../../components/analytics/MarketingAnalyticsWidget';
import GeographicWidget from '../../components/analytics/GeographicWidget';
import CustomerAnalyticsWidget from '../../components/analytics/CustomerAnalyticsWidget';
import FinancialAnalyticsWidget from '../../components/analytics/FinancialAnalyticsWidget';
import RevenueForecastWidget from '../../components/analytics/RevenueForecastWidget';
import ExecutiveSummaryWidget from '../../components/analytics/ExecutiveSummaryWidget';
import FunnelChart from '../../components/analytics/FunnelChart';
import LostReasonsChart from '../../components/analytics/LostReasonsChart';
import RepLeaderboard from '../../components/analytics/RepLeaderboard';

import BenchmarkAnalyticsWidget from '../../components/analytics/BenchmarkAnalyticsWidget';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
  ResponsiveContainer, Treemap
} from 'recharts';
import styles from './LeadAnalyticsPage.module.css';
import { 
  DUMMY_REVENUE_DATA,
  DUMMY_FUNNEL_DATA,
  DUMMY_LOST_DATA,
  DUMMY_WIN_RATE_DATA,
  DUMMY_SALES_CYCLE_DATA,
  DUMMY_AGING_DATA,
  DUMMY_RESPONSE_TIME_DATA,
  DUMMY_RESPONSE_TREND_DATA,
  DUMMY_SLA_DASHBOARD_DATA,
  DUMMY_VELOCITY_DATA,
  DUMMY_AI_INSIGHTS_DATA,
  DUMMY_AI_PREDICTION_DATA,
  DUMMY_MARKETING_DATA,
  DUMMY_PRODUCTIVITY_DATA,
  DUMMY_EXECUTIVE_DATA,
  DUMMY_GEO_DATA,
  DUMMY_CUSTOMER_DATA,
  DUMMY_FINANCIAL_DATA,
  DUMMY_FORECAST_DATA
} from '../../data/dummyAnalyticsData';


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

/* ── Default Empty Data ─────────────────────────── */
function getEmptyData() {
  return {
    kpis: {
      total:    { val: 0, trend: 0 },
      won:      { val: 0, trend: 0 },
      convRate: { val: '0%', trend: 0 },
      avgScore: { val: 0, trend: 0 },
    },
    weeklyData: [],
    stageData: [],
    sourceData: [],
    teamData: [],
  };
}

function getEmptyRevenueData() {
  return {
    kpis: {
      totalPipeline: { val: '$0', trend: 0 },
      wonRevenue: { val: '$0', trend: 0 },
      lostRevenue: { val: '$0', trend: 0 },
      expectedRevenue: { val: '$0', trend: 0 },
      avgDealSize: { val: '$0', trend: 0 },
      largestDeal: { val: '$0', trend: 0 },
    },
    stageRevenue: [],
    sourceRevenue: [],
    monthlyTrend: [],
    drillDownLeads: []
  };
}

// Filter Options
const FILTER_OPTIONS = {
  branch: ['North', 'South', 'East', 'West', 'Central'],
  salesperson: ['Sarah Smith', 'Mike Johnson', 'David Lee', 'Emma Wilson'],
  manager: ['John Doe', 'Alice Brown'],
  team: ['Alpha', 'Beta', 'Gamma'],
  source: ['Web', 'Referral', 'Walk-in', 'Partner', 'Social'],
  campaign: ['Summer Sale', 'Q1 B2B', 'Trade Show', 'Organic'],
  customerType: ['Enterprise', 'Commercial', 'Residential', 'Government'],
  projectType: ['Office Refit', 'Lobby', 'Full Building', 'Retail'],
  budgetRange: ['< $10k', '$10k - $50k', '$50k - $100k', '> $100k'],
  priority: ['Low', 'Medium', 'High', 'Critical'],
  status: ['New', 'Contacted', 'Site Visit', 'Quotation', 'Negotiation', 'Won', 'Lost'],
  tags: ['VIP', 'Urgent', 'Returning', 'At Risk'],
  city: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami'],
  state: ['CA', 'NY', 'TX', 'FL', 'IL'],
  date: ['Today', 'Yesterday', 'This Week', 'This Month', 'This Quarter', 'This Year', 'All Time']
};

/* ── Helpers ──────────────────────────────────────────────── */
function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

const CustomTreemapContent = (props) => {
  const { root, depth, x, y, width, height, index, payload, colors, rank, name, value, revenue } = props;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: depth < 2 ? PIE_COLORS[index % PIE_COLORS.length] : 'rgba(255,255,255,0)',
          stroke: '#fff',
          strokeWidth: 2 / (depth + 1e-10),
          strokeOpacity: 1 / (depth + 1e-10),
          cursor: 'pointer'
        }}
        onClick={() => {
           // In a real app we'd dispatch a click handler, but this is a helper outside the component.
        }}
      />
      {width > 50 && height > 30 ? (
        <text x={x + width / 2} y={y + height / 2 - 7} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={700}>
          {name}
        </text>
      ) : null}
      {width > 50 && height > 30 && value ? (
        <text x={x + width / 2} y={y + height / 2 + 7} textAnchor="middle" fill="#fff" fontSize={10} opacity={0.8}>
          {value}% Conv
        </text>
      ) : null}
    </g>
  );
};

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
          <span className={styles.tooltipVal}>{typeof p.value === 'number' && p.value >= 1000 ? `$${(p.value/1000).toFixed(0)}k` : p.value}</span>
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
  { value: 'Today', label: 'Today' },
  { value: 'This Week', label: 'This Week' },
  { value: 'This Month', label: 'This Month' },
  { value: 'This Quarter', label: 'This Quarter' },
  { value: 'This Year', label: 'This Year' },
  { value: 'All Time', label: 'All Time' },
  { value: 'Custom Range', label: 'Custom Range...' }
];

const DEFAULT_FILTERS = {
  date: 'This Month',
  branch: [],
  salesperson: [],
  manager: [],
  team: [],
  source: [],
  campaign: [],
  customerType: [],
  projectType: [],
  budgetRange: [],
  priority: [],
  status: [],
  tags: [],
  city: [],
  state: []
};

/* ═══════════════════════════════════════════════════════════ */

const DEFAULT_DASHBOARD_LAYOUT = [
  { i: 'lead_kpis', x: 0, y: 0, w: 12, h: 2, minW: 4, minH: 2 },
  { i: 'funnel', x: 0, y: 2, w: 12, h: 4, minW: 6, minH: 3 },
  { i: 'revenue_kpis', x: 0, y: 6, w: 12, h: 2, minW: 4, minH: 2 },
  { i: 'revenue_charts', x: 0, y: 8, w: 12, h: 5, minW: 6, minH: 4 },
  { i: 'sales_cycle', x: 0, y: 13, w: 12, h: 4, minW: 6, minH: 3 },
  { i: 'pipeline_vel', x: 0, y: 17, w: 12, h: 3, minW: 4, minH: 2 },
  { i: 'lost_leads', x: 0, y: 20, w: 12, h: 4, minW: 6, minH: 3 },
  { i: 'win_rate', x: 0, y: 24, w: 12, h: 4, minW: 6, minH: 3 },
  { i: 'sla', x: 0, y: 28, w: 12, h: 3, minW: 6, minH: 2 },
  { i: 'ai_revenue', x: 0, y: 31, w: 12, h: 4, minW: 6, minH: 3 },
  { i: 'ai_predict', x: 0, y: 35, w: 12, h: 4, minW: 6, minH: 3 },
  { i: 'sales_prod', x: 0, y: 39, w: 12, h: 5, minW: 6, minH: 4 },
  { i: 'marketing', x: 0, y: 44, w: 12, h: 5, minW: 6, minH: 4 },
  { i: 'geo', x: 0, y: 49, w: 12, h: 5, minW: 6, minH: 4 },
  { i: 'customer', x: 0, y: 54, w: 12, h: 5, minW: 6, minH: 4 },
  { i: 'financial', x: 0, y: 59, w: 12, h: 5, minW: 6, minH: 4 },
  { i: 'forecast', x: 0, y: 64, w: 12, h: 5, minW: 6, minH: 4 },
  { i: 'executive', x: 0, y: 69, w: 12, h: 6, minW: 6, minH: 5 },
  { i: 'goal_tracking', x: 0, y: 75, w: 12, h: 6, minW: 4, minH: 4 },
  { i: 'benchmark_analytics', x: 0, y: 81, w: 12, h: 6, minW: 6, minH: 5 },
  { i: 'project_outcomes', x: 0, y: 87, w: 12, h: 6, minW: 6, minH: 4 }
];

export default function LeadAnalyticsPage() {

  usePageTitle('Lead Analytics');
  useBreadcrumbs([{ label: 'Analytics' }, { label: 'Leads' }]);
  
  // -- Advanced Filter State --
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentPreset, setCurrentPreset] = useState('default');
  const [savedLayouts, setSavedLayouts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_dashboard_saved_layouts')) || {};
    } catch {
      return {};
    }
  });
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [removeLibraryOpen, setRemoveLibraryOpen] = useState(false);
  const [customDateOpen, setCustomDateOpen] = useState(false);
  const [layout, setLayout] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_dashboard_layout')) || DEFAULT_DASHBOARD_LAYOUT;
    } catch {
      return DEFAULT_DASHBOARD_LAYOUT;
    }
  });

  
  const addWidget = (widgetId) => {
    const newWidget = { i: widgetId, x: 0, y: 100, w: 12, h: 4, minW: 6, minH: 3 };
    setLayout(prev => [...prev, newWidget]);
    setLibraryOpen(false);
  };

  const handleRemoveWidget = (widgetId) => {
    setLayout(prev => prev.filter(l => l.i !== widgetId));
  };
  
  const saveCustomLayout = () => {
    const name = prompt('Enter a name for this layout (e.g. Sales View):');
    if (!name) return;
    const nextSaved = { ...savedLayouts, [name]: layout };
    setSavedLayouts(nextSaved);
    localStorage.setItem('crm_dashboard_saved_layouts', JSON.stringify(nextSaved));
    setCurrentPreset(name);
  };

  const saveLayout = () => {
    localStorage.setItem('crm_dashboard_layout', JSON.stringify(layout));
    setIsEditMode(false);
  };

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [tempFilters, setTempFilters] = useState(DEFAULT_FILTERS); // For modal
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [reportingCenterOpen, setReportingCenterOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [savedFilters, setSavedFilters] = useState(() => {
    try {
      const saved = localStorage.getItem('crm_saved_filters');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const activeChips = Object.entries(filters).flatMap(([key, val]) => {
    if (Array.isArray(val)) {
      return val.map(v => ({ key, value: v }));
    }
    if (val && key === 'date' && val !== 'All Time') {
      return [{ key, value: val }];
    }
    return [];
  });

  const removeChip = (chipKey, chipValue) => {
    setFilters(prev => {
      const next = { ...prev };
      if (Array.isArray(next[chipKey])) {
        next[chipKey] = next[chipKey].filter(v => v !== chipValue);
      } else {
        next[chipKey] = DEFAULT_FILTERS[chipKey];
      }
      return next;
    });
  };

  const clearAllFilters = () => setFilters(DEFAULT_FILTERS);

  const applyFilters = () => {
    setFilters(tempFilters);
    setFilterModalOpen(false);
  };

  const saveFilterPreset = () => {
    const name = prompt('Enter a name for this filter preset:');
    if (!name) return;
    const nextSaved = { ...savedFilters, [name]: filters };
    setSavedFilters(nextSaved);
    localStorage.setItem('crm_saved_filters', JSON.stringify(nextSaved));
  };

  const loadFilterPreset = (name) => {
    if (savedFilters[name]) {
      setFilters(savedFilters[name]);
    }
  };
  // ---------------------------

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [revenueData, setRevenueData] = useState(null);

  // Drilldown state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [drillDownLeads, setDrillDownLeads] = useState([]);

  // Win Rate Module state
  const [winRateDim, setWinRateDim] = useState('Salesperson');
  const [winRateSortKey, setWinRateSortKey] = useState('winRate');
  const [winRateSortDir, setWinRateSortDir] = useState('desc');

  const handleWinRateSort = (key) => {
    if (winRateSortKey === key) {
      setWinRateSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setWinRateSortKey(key);
      setWinRateSortDir('desc');
    }
  };

  useEffect(() => {
    setLoading(true);
    setData(null);
    setRevenueData(null);

    const rangeToParams = {
      '7d':  { from: new Date(Date.now() - 7  * 86400000).toISOString() },
      '30d': { from: new Date(Date.now() - 30 * 86400000).toISOString() },
      '90d': { from: new Date(Date.now() - 90 * 86400000).toISOString() },
      '1y':  { from: new Date(Date.now() - 365* 86400000).toISOString() },
    };

    const dateKey = filters.date === 'This Week' ? '7d' : 
                    filters.date === 'This Month' ? '30d' : 
                    filters.date === 'This Quarter' ? '90d' : '1y';

    Promise.allSettled([
      getLeadAnalytics(rangeToParams[dateKey]),
      getRevenueAnalytics(rangeToParams[dateKey])
    ]).then(([leadRes, revRes]) => {
      // Process Lead Analytics
      if (leadRes.status === 'fulfilled' && leadRes.value) {
        const raw = leadRes.value || {};
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
          setData(getEmptyData());
        } else {
          setData({
            kpis: {
              total:    { val: total, trend: 0 },
              won:      { val: won,   trend: 0 },
              convRate: { val: total > 0 ? `${((won / total) * 100).toFixed(1)}%` : '0%', trend: 0 },
              avgScore: { val: teamData.length ? Math.round(teamData.reduce((a,t)=>a+t.avgScore,0)/teamData.length) : 0, trend: 0 },
            },
            weeklyData,
            stageData,
            sourceData,
            teamData,
          });
        }
      } else {
        setData(getEmptyData());
      }

      // Process Revenue Analytics
      if (revRes.status === 'fulfilled' && revRes.value) {
        setRevenueData(revRes.value);
      } else {
        // Mock data if backend isn't ready for Revenue Analytics
        setRevenueData(DUMMY_REVENUE_DATA);
      }

    }).finally(() => setLoading(false));
  }, [filters]);

  if (loading || !data || !revenueData) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <div className={`${styles.skeleton} ${styles.skeletonTable}`} style={{ width: 200, height: 32, marginBottom: 8 }} />
            <div className={`${styles.skeleton} ${styles.skeletonTable}`} style={{ width: 300, height: 16 }} />
          </div>
        </div>
        <div className={styles.kpiStrip}>
          {[1, 2, 3, 4].map(i => <div key={i} className={`${styles.skeleton} ${styles.skeletonKpi}`} />)}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>Lead Analytics</h1>
          <p className={styles.desc}>Gain deep insights into your pipeline, revenue, and team performance.</p>
        </div>
        <div className={styles.controls}>
          {!isEditMode && (
            <button className={`${styles.rangePill} ${styles.rangePillActive}`} onClick={() => setIsEditMode(true)}>
              Edit Dashboard
            </button>
          )}
          <Select
            value={filters.date} 
            onChange={(val) => {
              if (val === 'Custom Range') {
                setCustomDateOpen(true);
              } else {
                setFilters(prev => ({...prev, date: val}));
              }
            }}
            options={DATE_RANGES.some(d => d.value === filters.date) ? DATE_RANGES : [...DATE_RANGES.filter(d => d.value !== 'Custom Range'), { value: filters.date, label: filters.date }, { value: 'Custom Range', label: 'Custom Range...' }]}
          />
        </div>
      </div>

            {isEditMode && (
        <div style={{ display: 'flex', gap: '8px', padding: '16px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
          <select 
            value={currentPreset} 
            onChange={(e) => {
              const val = e.target.value;
              setCurrentPreset(val);
              if (val === 'default') setLayout(DEFAULT_DASHBOARD_LAYOUT);
              else if (val === 'executive') setLayout(DEFAULT_DASHBOARD_LAYOUT.filter(l => ['executive', 'revenue_kpis', 'ai_revenue', 'forecast', 'goal_tracking', 'benchmark_analytics'].includes(l.i)));
              else if (val === 'marketing') setLayout(DEFAULT_DASHBOARD_LAYOUT.filter(l => ['marketing', 'lead_kpis', 'funnel', 'geo', 'goal_tracking', 'benchmark_analytics'].includes(l.i)));
              else if (val === 'sales') setLayout(DEFAULT_DASHBOARD_LAYOUT.filter(l => ['sales_cycle', 'pipeline_vel', 'win_rate', 'sales_prod', 'goal_tracking'].includes(l.i)));
              else if (val === 'manager') setLayout(DEFAULT_DASHBOARD_LAYOUT.filter(l => ['lead_kpis', 'revenue_kpis', 'sla', 'lost_leads', 'benchmark_analytics', 'executive'].includes(l.i)));
              else if (savedLayouts[val]) setLayout(savedLayouts[val]);
            }} 
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)' }}
          >
            <option value="default">Default View</option>
            <option value="executive">Executive View</option>
            <option value="marketing">Marketing View</option>
            <option value="sales">Sales View</option>
            <option value="manager">Manager View</option>
            {Object.keys(savedLayouts).length > 0 && <optgroup label="My Custom Layouts">
              {Object.keys(savedLayouts).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </optgroup>}
          </select>
          <button className={styles.rangePill} onClick={() => setLayout(DEFAULT_DASHBOARD_LAYOUT)}>Reset Layout</button>
          <button className={`${styles.rangePill} ${styles.rangePillActive}`} onClick={() => setLibraryOpen(true)}>+ Add Widget</button>
          <button className={`${styles.rangePill} ${styles.rangePillActive}`} onClick={() => setRemoveLibraryOpen(true)}>- Remove Widget</button>
          <button className={`${styles.rangePill} ${styles.rangePillActive}`} onClick={saveLayout}>Save Default</button>
          <button className={`${styles.rangePill} ${styles.rangePillActive}`} onClick={saveCustomLayout}>Save As...</button>
          <button className={styles.clearAllBtn} onClick={() => setIsEditMode(false)}>Exit Edit Mode</button>
        </div>
      )}

      <div className={styles.nativeGrid}>
        {layout.map(l => {
          let spanClass = styles.colSpan6; // Default to half-row for side-by-side
          // Large tables or timeline charts span the full row
          if (['project_outcomes', 'forecast'].includes(l.i)) {
            spanClass = styles.colSpan12;
          }

          let widgetContent = null;
          switch(l.i) {
            case 'lead_kpis': widgetContent = <LeadKPIsWidget filters={filters} />; break;
            case 'funnel': widgetContent = <FunnelChart filters={filters} />; break;
            case 'revenue_kpis': widgetContent = <RevenueKPIsWidget filters={filters} />; break;
            case 'revenue_charts': widgetContent = <RevenueChartsWidget filters={filters} />; break;
            case 'sales_cycle': widgetContent = <SalesCycleWidget filters={filters} />; break;
            case 'pipeline_vel': widgetContent = <PipelineVelocityWidget filters={filters} />; break;
            case 'lost_leads': widgetContent = <LostReasonsChart filters={filters} />; break;
            case 'win_rate': widgetContent = <RepLeaderboard filters={filters} />; break;
            case 'sla': widgetContent = <SLADashboardWidget filters={filters} />; break;
            case 'ai_revenue': widgetContent = <AIRevenueInsightsWidget filters={filters} />; break;
            case 'ai_predict': widgetContent = <AIPredictionWidget filters={filters} />; break;
            case 'sales_prod': widgetContent = <SalesProductivityWidget filters={filters} />; break;
            case 'marketing': widgetContent = <MarketingAnalyticsWidget filters={filters} />; break;
            case 'geo': widgetContent = <GeographicWidget filters={filters} />; break;
            case 'customer': widgetContent = <CustomerAnalyticsWidget filters={filters} />; break;
            case 'financial': widgetContent = <FinancialAnalyticsWidget filters={filters} />; break;
            case 'forecast': widgetContent = <RevenueForecastWidget filters={filters} />; break;
            case 'executive': widgetContent = <ExecutiveSummaryWidget filters={filters} />; break;
            case 'goal_tracking': widgetContent = <GoalTrackingWidget />; break;
            case 'benchmark_analytics': widgetContent = <BenchmarkAnalyticsWidget />; break;
            case 'project_outcomes': widgetContent = <LeadToProjectOutcomesWidget filters={filters} />; break;
            default: return null;
          }

          return (
            <div key={l.i} className={spanClass}>
              <WidgetContainer id={l.i} isEditMode={isEditMode} layout={layout} setLayout={setLayout}>
                {widgetContent}
              </WidgetContainer>
            </div>
          );
        })}
      </div>

      {/* ── Reporting Center Modal ── */}
      <ReportingCenterModal 
        isOpen={reportingCenterOpen} 
        onClose={() => setReportingCenterOpen(false)} 
      />

      {/* Add Widget Modal */}
      <WidgetLibraryModal 
        isOpen={libraryOpen} 
        onClose={() => setLibraryOpen(false)} 
        layout={layout}
        onAddWidget={addWidget}
      />

      {/* Remove Widget Modal */}
      <RemoveWidgetModal 
        isOpen={removeLibraryOpen} 
        onClose={() => setRemoveLibraryOpen(false)} 
        layout={layout}
        onRemoveWidget={handleRemoveWidget}
      />

      {/* Custom Date Modal */}
      <CustomDateModal
        isOpen={customDateOpen}
        onClose={() => setCustomDateOpen(false)}
        onApply={(rangeStr) => {
          setFilters(prev => ({ ...prev, date: rangeStr }));
          setCustomDateOpen(false);
        }}
      />

      {/* ── Advanced Drill-Down Modal ── */}
      <AnalyticsDrillDownModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title={modalTitle} 
        data={drillDownLeads} 
      />

      {/* ── Advanced Filter Modal ── */}
      <Modal isOpen={filterModalOpen} onClose={() => setFilterModalOpen(false)} title="Advanced Filters" size="lg">
        <div className={styles.filterModalGrid}>
          
          <div className={styles.filterGroup}>
            <label>Date Range</label>
            <select 
              value={tempFilters.date} 
              onChange={(e) => setTempFilters(prev => ({ ...prev, date: e.target.value }))}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
            >
              {FILTER_OPTIONS.date.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {['branch', 'salesperson', 'manager', 'team', 'source', 'campaign', 'customerType', 'projectType', 'budgetRange', 'priority', 'status', 'tags', 'city', 'state'].map(key => (
            <div key={key} className={styles.filterGroup}>
              <label>{key.replace(/([A-Z])/g, ' $1')}</label>
              <select 
                multiple
                value={tempFilters[key]}
                onChange={(e) => {
                  const options = Array.from(e.target.selectedOptions, option => option.value);
                  setTempFilters(prev => ({ ...prev, [key]: options }));
                }}
                style={{ height: '100px', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
              >
                {FILTER_OPTIONS[key].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          ))}

        </div>
        <div className={styles.filterModalActions}>
          <button 
            className={styles.clearAllBtn} 
            onClick={() => setTempFilters(DEFAULT_FILTERS)} 
            style={{ marginRight: 'auto', textDecoration: 'none', background: 'var(--color-surface-2)', padding: '8px 16px', borderRadius: '4px' }}
          >
            Reset Form
          </button>
          <button 
            className={styles.rangePill} 
            onClick={() => setFilterModalOpen(false)}
          >
            Cancel
          </button>
          <button 
            className={styles.rangePillActive} 
            onClick={applyFilters}
            style={{ background: 'var(--color-accent)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}
          >
            Apply Filters ({Object.values(tempFilters).flat().filter(v => v && v !== 'All Time').length})
          </button>
        </div>
      </Modal>

    </div>
  );
}
