import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
const ResponsiveGridLayout = WidthProvider(Responsive);
import { getLeadAnalytics, getRevenueAnalytics } from '../../api/analytics';
import { Select, Avatar, Badge, Modal } from '../../components/ui'
import AnalyticsDrillDownModal from '../../components/analytics/AnalyticsDrillDownModal';
import ReportingCenterModal from '../../components/analytics/ReportingCenterModal';
import AnalyticsAlertsPanel from '../../components/analytics/AnalyticsAlertsPanel';
import GoalTrackingWidget from '../../components/analytics/GoalTrackingWidget';
import BenchmarkAnalyticsWidget from '../../components/analytics/BenchmarkAnalyticsWidget';
import WidgetContainer from '../../components/analytics/WidgetContainer';
import WidgetLibraryModal from '../../components/analytics/WidgetLibraryModal';
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

// Dummy Revenue Data for Demo
const DUMMY_REVENUE_DATA = {
  kpis: {
    totalPipeline: { val: '$1.2M', trend: 15 },
    wonRevenue: { val: '$450k', trend: 8 },
    lostRevenue: { val: '$120k', trend: -5 },
    expectedRevenue: { val: '$630k', trend: 12 },
    avgDealSize: { val: '$45k', trend: 3 },
    largestDeal: { val: '$150k', trend: 0 },
  },
  stageRevenue: [
    { stage: 'New', revenue: 100000 },
    { stage: 'Contacted', revenue: 150000 },
    { stage: 'Site Visit', revenue: 200000 },
    { stage: 'Quotation', revenue: 300000 },
    { stage: 'Negotiation', revenue: 450000 },
  ],
  sourceRevenue: [
    { name: 'Website', revenue: 300000 },
    { name: 'Referral', revenue: 400000 },
    { name: 'Social Media', revenue: 200000 },
    { name: 'Cold Call', revenue: 100000 },
    { name: 'Other', revenue: 200000 },
  ],
  monthlyTrend: [
    { month: 'Jan', won: 30000, lost: 10000 },
    { month: 'Feb', won: 40000, lost: 15000 },
    { month: 'Mar', won: 35000, lost: 5000 },
    { month: 'Apr', won: 50000, lost: 20000 },
    { month: 'May', won: 80000, lost: 25000 },
    { month: 'Jun', won: 120000, lost: 30000 },
  ],
  drillDownLeads: [
    { id: 1, name: 'John Doe', stage: 'Won', amount: '$45,000', source: 'Website', date: '2023-10-12' },
    { id: 2, name: 'Acme Corp', stage: 'Negotiation', amount: '$120,000', source: 'Referral', date: '2023-10-15' },
    { id: 3, name: 'Jane Smith', stage: 'Won', amount: '$85,000', source: 'Social Media', date: '2023-10-18' },
    { id: 4, name: 'Tech Solutions', stage: 'Quotation', amount: '$60,000', source: 'Cold Call', date: '2023-10-20' },
  ]
};

// Dummy Funnel Data for Demo
const DUMMY_FUNNEL_DATA = [
  { stage: 'New', count: 1200, convPct: 100, dropPct: 0, avgTime: '2 hrs', value: '$1.2M' },
  { stage: 'Contacted', count: 900, convPct: 75, dropPct: 25, avgTime: '1.5 days', value: '$900k' },
  { stage: 'Site Visit', count: 600, convPct: 50, dropPct: 33, avgTime: '3 days', value: '$600k' },
  { stage: 'Quotation', count: 300, convPct: 25, dropPct: 50, avgTime: '4 days', value: '$300k' },
  { stage: 'Negotiation', count: 150, convPct: 12.5, dropPct: 50, avgTime: '7 days', value: '$150k' },
  { stage: 'Won', count: 75, convPct: 6.25, dropPct: 50, avgTime: '-', value: '$75k' },
];

// Dummy Lost Lead Data for Demo
const DUMMY_LOST_DATA = {
  kpis: {
    totalLost: { val: 345, trend: -12 },
    lostRevenue: { val: '$320k', trend: -5 },
    lossRate: { val: '28%', trend: -2 },
    avgLostDeal: { val: '$18k', trend: 4 },
  },
  insights: {
    topReason: 'Price too high (45%)',
    avgLostTime: '12 Days',
    recoveryOpps: '42 Leads ($85k)'
  },
  reasons: [
    { name: 'Price', count: 155 },
    { name: 'Competitor', count: 90 },
    { name: 'Timing', count: 55 },
    { name: 'Unresponsive', count: 45 },
  ],
  byStage: [
    { stage: 'New', count: 120 },
    { stage: 'Contacted', count: 90 },
    { stage: 'Site Visit', count: 70 },
    { stage: 'Quotation', count: 40 },
    { stage: 'Negotiation', count: 25 },
  ],
  bySalesperson: [
    { name: 'John', count: 120 },
    { name: 'Sarah', count: 95 },
    { name: 'Mike', count: 80 },
    { name: 'Emma', count: 50 },
  ],
  bySource: [
    { name: 'Cold Call', count: 150 },
    { name: 'Website', count: 100 },
    { name: 'Social', count: 65 },
    { name: 'Referral', count: 30 },
  ],
  monthlyTrend: [
    { month: 'Jan', lost: 45 },
    { month: 'Feb', lost: 55 },
    { month: 'Mar', lost: 40 },
    { month: 'Apr', lost: 60 },
    { month: 'May', lost: 75 },
    { month: 'Jun', lost: 70 },
  ]
};

// Dummy Win Rate Analytics Data
const DUMMY_WIN_RATE_DATA = {
  Salesperson: [
    { name: 'John Doe', winRate: 35, total: 120, trend: 5 },
    { name: 'Sarah Smith', winRate: 42, total: 95, trend: 12 },
    { name: 'Mike Johnson', winRate: 28, total: 80, trend: -3 },
    { name: 'Emma Davis', winRate: 31, total: 50, trend: 2 },
  ],
  Team: [
    { name: 'Alpha Team', winRate: 38, total: 200, trend: 8 },
    { name: 'Beta Team', winRate: 32, total: 180, trend: 1 },
    { name: 'Gamma Team', winRate: 25, total: 150, trend: -4 },
  ],
  Branch: [
    { name: 'New York', winRate: 40, total: 300, trend: 10 },
    { name: 'London', winRate: 35, total: 250, trend: 4 },
    { name: 'Singapore', winRate: 22, total: 180, trend: -6 },
  ],
  'Lead Source': [
    { name: 'Referral', winRate: 55, total: 80, trend: 15 },
    { name: 'Website', winRate: 25, total: 200, trend: 2 },
    { name: 'Cold Call', winRate: 12, total: 300, trend: -1 },
    { name: 'Social', winRate: 18, total: 150, trend: 3 },
  ],
  Campaign: [
    { name: 'Summer Promo', winRate: 30, total: 120, trend: 5 },
    { name: 'Black Friday', winRate: 45, total: 180, trend: 20 },
    { name: 'B2B Outreach', winRate: 22, total: 90, trend: -2 },
  ],
  Month: [
    { name: 'January', winRate: 28, total: 100, trend: 2 },
    { name: 'February', winRate: 32, total: 110, trend: 4 },
    { name: 'March', winRate: 30, total: 150, trend: -2 },
  ],
  Quarter: [
    { name: 'Q1 2023', winRate: 30, total: 360, trend: 3 },
    { name: 'Q2 2023', winRate: 34, total: 400, trend: 4 },
    { name: 'Q3 2023', winRate: 31, total: 380, trend: -3 },
  ]
};

// Dummy Sales Cycle Analytics Data
const DUMMY_SALES_CYCLE_DATA = [
  { from: 'New', to: 'Contacted', avg: 1.2, min: 0.5, max: 4, median: 1, sla: 2, slaExceeded: false },
  { from: 'Contacted', to: 'Site Visit', avg: 3.5, min: 1, max: 8, median: 3, sla: 3, slaExceeded: true },
  { from: 'Site Visit', to: 'Quotation', avg: 2.1, min: 1, max: 5, median: 2, sla: 2, slaExceeded: true },
  { from: 'Quotation', to: 'Negotiation', avg: 4.8, min: 2, max: 12, median: 4, sla: 5, slaExceeded: false },
  { from: 'Negotiation', to: 'Won', avg: 7.5, min: 3, max: 20, median: 6, sla: 10, slaExceeded: false },
];

// Dummy Stage Aging Analytics Data
const DUMMY_AGING_DATA = [
  { stage: 'New', avgAge: 1.5, youngest: 0, oldest: 5, sla: 2, exceededCount: 12 },
  { stage: 'Contacted', avgAge: 4.2, youngest: 1, oldest: 15, sla: 3, exceededCount: 45 },
  { stage: 'Site Visit', avgAge: 2.8, youngest: 1, oldest: 10, sla: 5, exceededCount: 8 },
  { stage: 'Quotation', avgAge: 8.5, youngest: 2, oldest: 25, sla: 7, exceededCount: 65 },
  { stage: 'Negotiation', avgAge: 14.2, youngest: 5, oldest: 45, sla: 10, exceededCount: 120 },
];

// Dummy Response Time Analytics Data
const DUMMY_RESPONSE_TIME_DATA = [
  { from: 'Lead Created', to: 'First Contact', avg: '2.5 hrs', avgRaw: 2.5, min: '5 mins', max: '1.2 days', median: '1.5 hrs', sla: '4 hrs', lateCount: 15, slaExceeded: false },
  { from: 'First Contact', to: 'First Meeting', avg: '1.5 days', avgRaw: 36, min: '2 hrs', max: '4 days', median: '1 day', sla: '2 days', lateCount: 8, slaExceeded: false },
  { from: 'First Meeting', to: 'Quotation', avg: '3.2 days', avgRaw: 76.8, min: '1 day', max: '8 days', median: '2.5 days', sla: '3 days', lateCount: 22, slaExceeded: true },
  { from: 'Quotation', to: 'Negotiation', avg: '4.5 days', avgRaw: 108, min: '2 days', max: '12 days', median: '4 days', sla: '5 days', lateCount: 12, slaExceeded: false },
  { from: 'Negotiation', to: 'Won', avg: '8.2 days', avgRaw: 196.8, min: '3 days', max: '25 days', median: '6 days', sla: '7 days', lateCount: 30, slaExceeded: true },
];

const DUMMY_RESPONSE_TREND_DATA = [
  { month: 'Jan', avgHours: 5.2 },
  { month: 'Feb', avgHours: 4.8 },
  { month: 'Mar', avgHours: 3.5 },
  { month: 'Apr', avgHours: 3.8 },
  { month: 'May', avgHours: 2.9 },
  { month: 'Jun', avgHours: 2.5 },
];

// Dummy SLA Dashboard Data
const DUMMY_SLA_DASHBOARD_DATA = [
  { id: 'sla-1', title: 'Overdue Leads', count: 42, icon: '⏱️', severity: 'Critical', actionText: 'Reassign All' },
  { id: 'sla-2', title: 'Late Follow-ups', count: 18, icon: '📞', severity: 'High', actionText: 'Send Reminders' },
  { id: 'sla-3', title: 'Late Quotations', count: 7, icon: '📄', severity: 'Medium', actionText: 'View Pending' },
  { id: 'sla-4', title: 'Missed Calls', count: 12, icon: '📵', severity: 'High', actionText: 'Call Back Now' },
  { id: 'sla-5', title: 'No Activity (>7d)', count: 56, icon: '💤', severity: 'Critical', actionText: 'Run Campaign' },
  { id: 'sla-6', title: 'Site Visit Delays', count: 5, icon: '🏢', severity: 'Low', actionText: 'Follow Up' },
  { id: 'sla-7', title: 'Negotiation Delays', count: 14, icon: '🤝', severity: 'Medium', actionText: 'Review Deals' },
];

// Dummy Pipeline Velocity Data
const DUMMY_VELOCITY_DATA = {
  kpis: {
    deals: 120,
    winRate: 35, // %
    avgDealValue: 45000,
    salesCycle: 42, // days
    velocity: 45000, // (120 * 0.35 * 45000) / 42 = ~45000 / day
    expectedRevenueVelocity: 1350000, // per month (velocity * 30)
  },
  trend: [
    { month: 'Jan', velocity: 32000 },
    { month: 'Feb', velocity: 35000 },
    { month: 'Mar', velocity: 38000 },
    { month: 'Apr', velocity: 31000 },
    { month: 'May', velocity: 41000 },
    { month: 'Jun', velocity: 45000 },
  ],
  byTeam: [
    { name: 'Alpha Team', velocity: 22000 },
    { name: 'Beta Team', velocity: 15000 },
    { name: 'Gamma Team', velocity: 8000 },
  ],
  bySource: [
    { name: 'Referral', velocity: 18000 },
    { name: 'Website', velocity: 12000 },
    { name: 'Social', velocity: 9000 },
    { name: 'Cold Call', velocity: 6000 },
  ]
};

// Dummy AI Insights Data
const DUMMY_AI_INSIGHTS_DATA = [
  {
    id: 'ai-1',
    title: 'Conversion Dropped This Month',
    description: 'Overall conversion rate dropped by 4% in June. Primarily driven by a bottleneck at the Quotation stage.',
    priority: 'P1',
    severity: 'Critical',
    confidence: '98%',
    actionText: 'Investigate Bottleneck'
  },
  {
    id: 'ai-2',
    title: 'Best Performing Source',
    description: 'Referrals have a 55% win rate and the highest pipeline velocity. Consider allocating more budget to referral programs.',
    priority: 'P2',
    severity: 'Low',
    confidence: '94%',
    actionText: 'Review Budget'
  },
  {
    id: 'ai-3',
    title: 'Weakest Stage Identified',
    description: 'Negotiation stage aging has increased to 14.2 days on average, exceeding SLA limit by 42%.',
    priority: 'P1',
    severity: 'High',
    confidence: '91%',
    actionText: 'View Delayed Leads'
  },
  {
    id: 'ai-4',
    title: 'Revenue Growth Potential',
    description: 'Expected revenue velocity is trending upwards, driven by larger average deal sizes in Q3.',
    priority: 'P3',
    severity: 'Low',
    confidence: '88%',
    actionText: 'View Trend'
  },
  {
    id: 'ai-5',
    title: 'Employee Improving',
    description: 'Sarah Smith improved her win rate by 12% over the last 30 days, becoming the top performer.',
    priority: 'P3',
    severity: 'Low',
    confidence: '96%',
    actionText: 'Congratulate'
  },
  {
    id: 'ai-6',
    title: 'Employee Declining',
    description: 'Mike Johnson’s response time has slowed by 35%, contributing to 8 SLA breaches this week.',
    priority: 'P2',
    severity: 'Medium',
    confidence: '85%',
    actionText: 'Assign Coaching'
  }
];

// Dummy AI Lead Predictions
const DUMMY_AI_PREDICTION_DATA = {
  mostLikelyWins: [
    { name: 'Acme Corp Renovations', winProb: '94%', expValue: 120000, closeDate: 'Jun 28', risk: 'Low' },
    { name: 'Zenith Office Fitout', winProb: '88%', expValue: 85000, closeDate: 'Jul 05', risk: 'Low' },
  ],
  mostLikelyLosses: [
    { name: 'Globex Inc Lobby', winProb: '12%', expValue: 45000, closeDate: 'N/A', risk: 'High' },
    { name: 'Initech Expansion', winProb: '18%', expValue: 110000, closeDate: 'N/A', risk: 'High' },
  ],
  highRiskDeals: [
    { name: 'Stark Tower Lounge', winProb: '45%', expValue: 250000, closeDate: 'Jul 15', risk: 'High' },
    { name: 'Wayne Manor Suite', winProb: '52%', expValue: 180000, closeDate: 'Jul 20', risk: 'High' },
  ],
  highestOpportunity: [
    { name: 'Oscorp Lab Refit', winProb: '75%', expValue: 850000, closeDate: 'Aug 10', risk: 'Medium' },
    { name: 'LexCorp HQ', winProb: '68%', expValue: 620000, closeDate: 'Sep 01', risk: 'Medium' },
  ]
};

// Dummy Marketing Analytics Data
const DUMMY_MARKETING_DATA = {
  kpis: {
    spend: 45000,
    revenue: 675000,
    roi: 1400, // %
    cpl: 150, // Cost Per Lead
    cpa: 450, // Cost Per Acquisition
    convRate: 33, // %
    avgDealSize: 55000,
  },
  byCampaign: [
    { name: 'Summer Promo', spend: 15000, revenue: 250000, roi: 1566, cpl: 120, leads: 125 },
    { name: 'LinkedIn Ads Q2', spend: 20000, revenue: 320000, roi: 1500, cpl: 180, leads: 111 },
    { name: 'Trade Show 2026', spend: 10000, revenue: 105000, roi: 950, cpl: 156, leads: 64 },
  ]
};

// Dummy Productivity Data
const DUMMY_PRODUCTIVITY_DATA = {
  kpis: {
    score: 84, // Out of 100
    calls: 1245,
    meetings: 180,
    siteVisits: 65,
    whatsapp: 3200,
    emails: 1540,
    tasks: 450,
    notes: 210,
    followUps: 890,
  },
  ranking: [
    { name: 'Sarah Smith', score: 95, calls: 320, meetings: 55, visits: 25, tasks: 120 },
    { name: 'David Lee', score: 88, calls: 280, meetings: 45, visits: 18, tasks: 110 },
    { name: 'Mike Johnson', score: 72, calls: 210, meetings: 30, visits: 10, tasks: 90 },
    { name: 'Emily Chen', score: 65, calls: 180, meetings: 25, visits: 8, tasks: 75 },
  ],
  timeline: [
    { date: 'Jun 1', calls: 45, meetings: 8, visits: 3, messages: 120 },
    { date: 'Jun 2', calls: 52, meetings: 6, visits: 2, messages: 150 },
    { date: 'Jun 3', calls: 48, meetings: 10, visits: 4, messages: 130 },
    { date: 'Jun 4', calls: 60, meetings: 5, visits: 1, messages: 180 },
    { date: 'Jun 5', calls: 55, meetings: 12, visits: 5, messages: 160 },
    { date: 'Jun 6', calls: 30, meetings: 2, visits: 0, messages: 80 }, // weekend
    { date: 'Jun 7', calls: 25, meetings: 0, visits: 0, messages: 60 },
  ],
  heatmapDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  heatmapHours: ['8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM'],
  // Random activity intensity (0-10)
  heatmapData: Array.from({ length: 7 }, () => Array.from({ length: 6 }, () => Math.floor(Math.random() * 11)))
};

// Dummy Executive Data
const DUMMY_EXECUTIVE_DATA = {
  topPerformer: { name: 'Sarah Smith', stat: '$1.2M Won' },
  lowestPerformer: { name: 'Mike Johnson', stat: '12% Win Rate' },
  biggestDeal: { name: 'Oscorp Lab Refit', stat: '$850k (Neg)' },
  oldestLead: { name: 'Globex Inc Lobby', stat: '142 Days' },
  highestRevSource: { name: 'Referrals', stat: '$2.4M (45%)' },
  highestRevProject: { name: 'Acme Corp Renovations', stat: '$1.8M Closed' },
  mostDelayedStage: { name: 'Negotiation', stat: 'Avg 14.2 Days' },
  criticalAlerts: { count: 12, stat: '8 SLA Breaches' },
  revenueForecast: { value: '$4.5M', stat: 'Q3 Expected' },
  pipelineHealth: { status: 'Good', score: '84/100', color: SUCCESS }
};

// Dummy Geographic Data
const DUMMY_GEO_DATA = {
  kpis: {
    topRegion: { name: 'North America', rev: '$2.1M' },
    topCountry: { name: 'United States', rev: '$1.8M' },
    topState: { name: 'California', leads: 450 },
    topCity: { name: 'San Francisco', leads: 180 },
  },
  // Treemap Data for Heatmap representation (size = volume, value = convRate)
  treemapData: [
    { name: 'North America', children: [
        { name: 'California', size: 450, value: 35, revenue: 850000 },
        { name: 'New York', size: 320, value: 28, revenue: 620000 },
        { name: 'Texas', size: 280, value: 22, revenue: 330000 }
      ] 
    },
    { name: 'Europe', children: [
        { name: 'London', size: 210, value: 18, revenue: 410000 },
        { name: 'Berlin', size: 150, value: 15, revenue: 280000 },
        { name: 'Paris', size: 130, value: 12, revenue: 190000 }
      ] 
    },
    { name: 'Asia', children: [
        { name: 'Tokyo', size: 190, value: 25, revenue: 320000 },
        { name: 'Singapore', size: 160, value: 30, revenue: 290000 },
        { name: 'Mumbai', size: 220, value: 20, revenue: 250000 }
      ] 
    }
  ],
  ranking: [
    { country: 'United States', state: 'California', city: 'San Francisco', area: 'Downtown', pin: '94105', leads: 180, revenue: 420000, conv: 38 },
    { country: 'United States', state: 'New York', city: 'New York City', area: 'Manhattan', pin: '10001', leads: 150, revenue: 380000, conv: 35 },
    { country: 'India', state: 'Maharashtra', city: 'Mumbai', area: 'Bandra', pin: '400050', leads: 120, revenue: 150000, conv: 22 },
    { country: 'United Kingdom', state: 'England', city: 'London', area: 'Westminster', pin: 'SW1A', leads: 110, revenue: 250000, conv: 19 },
    { country: 'Singapore', state: 'Central', city: 'Singapore', area: 'Marina Bay', pin: '018956', leads: 95, revenue: 210000, conv: 32 },
  ]
};

// Dummy Customer Analytics Data
const DUMMY_CUSTOMER_DATA = {
  kpis: {
    repeatCustomers: 450,
    referralCustomers: 210,
    cltv: 125000, // Customer Lifetime Value
    avgProjectValue: 65000,
    repeatPurchaseRate: 18, // %
    revenuePerCustomer: 42000,
  },
  segmentation: [
    { name: 'Enterprise', value: 45, fill: PURPLE },
    { name: 'Commercial', value: 35, fill: INFO },
    { name: 'Residential', value: 15, fill: ACCENT },
    { name: 'Government', value: 5, fill: WARNING },
  ],
  topCustomers: [
    { name: 'Oscorp Industries', type: 'Enterprise', projects: 5, lifetimeValue: 2450000, lastPurchase: 'Jun 12, 2026' },
    { name: 'Wayne Enterprises', type: 'Enterprise', projects: 3, lifetimeValue: 1850000, lastPurchase: 'May 04, 2026' },
    { name: 'Central Perk', type: 'Commercial', projects: 2, lifetimeValue: 420000, lastPurchase: 'Jul 01, 2026' },
    { name: 'Stark Tower Mgmt', type: 'Enterprise', projects: 4, lifetimeValue: 3100000, lastPurchase: 'Jan 15, 2026' },
  ]
};

// Dummy Financial Analytics Data
const DUMMY_FINANCIAL_DATA = {
  kpis: {
    quotationValue: 8500000,
    invoiceValue: 5200000,
    paymentCollected: 4800000,
    outstanding: 400000,
    profit: 1600000,
    margin: 30.7, // %
    discount: 150000,
  },
  trendData: [
    { name: 'Jan', revenue: 400000, cashflow: 350000 },
    { name: 'Feb', revenue: 450000, cashflow: 380000 },
    { name: 'Mar', revenue: 600000, cashflow: 420000 },
    { name: 'Apr', revenue: 550000, cashflow: 500000 },
    { name: 'May', revenue: 700000, cashflow: 650000 },
    { name: 'Jun', revenue: 800000, cashflow: 720000 },
    { name: 'Jul', revenue: 950000, cashflow: 810000 },
  ]
};

// Dummy Revenue Forecast Data
const DUMMY_FORECAST_DATA = {
  kpis: {
    weekly: 150000,
    monthly: 620000,
    quarterly: 2450000,
    yearly: 10500000,
  },
  pipeline: {
    expectedClosings: 18,
    likelyWins: 14,
    likelyLosses: 4,
    accuracy: 94, // %
    confidence: 'High (89%)',
  },
  projectionData: [
    { name: 'W1', actual: 120000, forecast: 110000 },
    { name: 'W2', actual: 140000, forecast: 135000 },
    { name: 'W3', actual: 165000, forecast: 150000 },
    { name: 'W4', actual: null, forecast: 180000 }, // Future
    { name: 'W5', actual: null, forecast: 210000 }, // Future
  ]
};

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
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_month', label: 'Last Month' },
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
  { i: 'benchmark_analytics', x: 0, y: 81, w: 12, h: 6, minW: 6, minH: 5 }
];

export default function LeadAnalyticsPage() {

  usePageTitle('Lead Analytics');
  useBreadcrumbs([{ label: 'Analytics' }, { label: 'Leads' }]);
  
  // -- Advanced Filter State --
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentPreset, setCurrentPreset] = useState('default');
  const [layout, setLayout] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_dashboard_layout')) || DEFAULT_DASHBOARD_LAYOUT;
    } catch {
      return DEFAULT_DASHBOARD_LAYOUT;
    }
  });

  
  const addWidget = (widgetId) => {
    // Determine default sizing based on ID roughly, or use a generic 6x4
    const newWidget = { i: widgetId, x: 0, y: 100, w: 12, h: 4, minW: 6, minH: 3 };
    setLayout(prev => [...prev, newWidget]);
    setLibraryOpen(false);
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
  const [libraryOpen, setLibraryOpen] = useState(false);
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
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <h1 className={styles.pageTitle}>Lead Analytics</h1>
          <p className={styles.pageDesc}>Gain deep insights into your pipeline, revenue, and team performance.</p>
        </div>
        <div className={styles.controls}>
          <Select 
            value={filters.date} 
            onChange={(e) => setFilters(prev => ({...prev, date: e.target.value}))}
            options={DATE_RANGES}
          />
        </div>
      </div>

      <div className={styles.filterBarContainer}>
        <div className={styles.headerRow} style={{ marginBottom: 0 }}>
          <div className={styles.filterControlsRow}>
            {Object.keys(savedFilters).length > 0 && (
              <select 
                className={styles.rangePill} 
                style={{ background: 'var(--color-surface-2)' }}
                onChange={(e) => {
                  if (e.target.value) loadFilterPreset(e.target.value);
                  e.target.value = ''; // reset so it acts like a trigger
                }}
              >
                <option value="">Load Preset...</option>
                {Object.keys(savedFilters).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}

            <button
              className={styles.rangePill}
              style={{ background: alertsOpen ? 'var(--color-accent)' : 'var(--color-surface-2)', color: alertsOpen ? '#fff' : 'inherit', marginRight: '8px', position: 'relative' }}
              onClick={() => setAlertsOpen(true)}
            >
              <span style={{ marginRight: '6px' }}>🔔</span>
              Alerts
              <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#DC2626', color: '#fff', fontSize: '10px', fontWeight: 'bold', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>7</span>
            </button>

            <button
              className={styles.rangePill}
              style={{ background: isEditMode ? 'var(--color-accent)' : 'var(--color-surface-2)', color: isEditMode ? '#fff' : 'inherit', marginRight: '8px' }}
              onClick={() => setIsEditMode(!isEditMode)}
            >
              <span style={{ marginRight: '6px' }}>⚙️</span>
              Edit Dashboard
            </button>

            <button
              className={styles.rangePill}
              style={{ background: reportingCenterOpen ? 'var(--color-accent)' : 'var(--color-surface-2)', color: reportingCenterOpen ? '#fff' : 'inherit', marginRight: '8px' }}
              onClick={() => setReportingCenterOpen(true)}
            >
              <span style={{ marginRight: '6px' }}>📊</span>
              Reporting Center
            </button>

            <button
              className={styles.rangePill}
              style={{ background: filterModalOpen ? 'var(--color-accent)' : 'var(--color-surface-2)', color: filterModalOpen ? '#fff' : 'inherit' }}
              onClick={() => {
                setTempFilters(filters);
                setFilterModalOpen(true);
              }}
            >
              <span style={{ marginRight: '6px' }}>⚙️</span>
              Advanced Filters ({activeChips.length})
            </button>
          </div>
        </div>

        {activeChips.length > 0 && (
          <div className={styles.filterChipsContainer}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginRight: '4px' }}>Active:</span>
            {activeChips.map((chip, idx) => (
              <div key={`${chip.key}-${chip.value}-${idx}`} className={styles.filterChip}>
                {chip.key}: {chip.value}
                <span className={styles.filterChipClose} onClick={() => removeChip(chip.key, chip.value)}>×</span>
              </div>
            ))}
            <button className={styles.clearAllBtn} onClick={clearAllFilters}>Clear All</button>
            <button className={styles.clearAllBtn} onClick={saveFilterPreset} style={{ color: 'var(--color-accent)' }}>Save as Preset</button>
          </div>
        )}
      </div>

      {isEditMode && (
        <div style={{ background: 'var(--color-surface-2)', padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>Dashboard Customizer</span>
          <select 
            value={currentPreset} 
            onChange={(e) => {
              setCurrentPreset(e.target.value);
              if (e.target.value === 'default') setLayout(DEFAULT_DASHBOARD_LAYOUT);
              if (e.target.value === 'executive') setLayout(DEFAULT_DASHBOARD_LAYOUT.filter(l => ['executive', 'revenue_kpis', 'ai_revenue', 'forecast', 'goal_tracking', 'benchmark_analytics'].includes(l.i)));
              if (e.target.value === 'marketing') setLayout(DEFAULT_DASHBOARD_LAYOUT.filter(l => ['marketing', 'lead_kpis', 'funnel', 'geo', 'goal_tracking', 'benchmark_analytics'].includes(l.i)));
            }} 
            style={{ padding: '8px', borderRadius: '4px' }}
          >
            <option value="default">Default Preset</option>
            <option value="executive">Executive Preset</option>
            <option value="marketing">Marketing Preset</option>
          </select>
          <button className={styles.rangePill} onClick={() => setLayout(DEFAULT_DASHBOARD_LAYOUT)}>Reset Layout</button>
          <button className={styles.rangePillActive} onClick={() => setLibraryOpen(true)}>+ Add Widget</button>
          <button className={styles.rangePillActive} onClick={saveLayout}>Save Layout</button>
          <button className={styles.clearAllBtn} onClick={() => setIsEditMode(false)}>Exit Edit Mode</button>
        </div>
      )}

      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: layout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={100}
        onLayoutChange={(newLayout) => setLayout(newLayout)}
        isDraggable={isEditMode}
        isResizable={isEditMode}
        useCSSTransforms={true}
      >
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
)}
{layout.some(l => l.i === 'goal_tracking') && (
  <div key="goal_tracking">
    <WidgetContainer id="goal_tracking" isEditMode={isEditMode} layout={layout} setLayout={setLayout}>
    <GoalTrackingWidget onClick={handleCardClick} />
      </WidgetContainer>
</div>
)}
      {layout.some(l => l.i === 'benchmark_analytics') && (
  <div key="benchmark_analytics">
    <WidgetContainer id="benchmark_analytics" isEditMode={isEditMode} layout={layout} setLayout={setLayout}>
    <BenchmarkAnalyticsWidget onClick={handleCardClick} />
      </WidgetContainer>
</div>
)}
      </ResponsiveGridLayout>

      {/* ── Reporting Center Modal ── */}
      <ReportingCenterModal 
        isOpen={reportingCenterOpen} 
        onClose={() => setReportingCenterOpen(false)} 
      />

      {/* ── Widget Library Modal ── */}
      <WidgetLibraryModal isOpen={libraryOpen} onClose={() => setLibraryOpen(false)} layout={layout} onAddWidget={addWidget} />

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
