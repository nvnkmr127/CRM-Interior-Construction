// Dummy Revenue Data for Demo
export const DUMMY_REVENUE_DATA = {
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
export const DUMMY_FUNNEL_DATA = [
  { stage: 'New', count: 1200, convPct: 100, dropPct: 0, avgTime: '2 hrs', value: '$1.2M' },
  { stage: 'Contacted', count: 900, convPct: 75, dropPct: 25, avgTime: '1.5 days', value: '$900k' },
  { stage: 'Site Visit', count: 600, convPct: 50, dropPct: 33, avgTime: '3 days', value: '$600k' },
  { stage: 'Quotation', count: 300, convPct: 25, dropPct: 50, avgTime: '4 days', value: '$300k' },
  { stage: 'Negotiation', count: 150, convPct: 12.5, dropPct: 50, avgTime: '7 days', value: '$150k' },
  { stage: 'Won', count: 75, convPct: 6.25, dropPct: 50, avgTime: '-', value: '$75k' },
];

// Dummy Lost Lead Data for Demo
export const DUMMY_LOST_DATA = {
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
export const DUMMY_WIN_RATE_DATA = {
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
export const DUMMY_SALES_CYCLE_DATA = [
  { from: 'New', to: 'Contacted', avg: 1.2, min: 0.5, max: 4, median: 1, sla: 2, slaExceeded: false },
  { from: 'Contacted', to: 'Site Visit', avg: 3.5, min: 1, max: 8, median: 3, sla: 3, slaExceeded: true },
  { from: 'Site Visit', to: 'Quotation', avg: 2.1, min: 1, max: 5, median: 2, sla: 2, slaExceeded: true },
  { from: 'Quotation', to: 'Negotiation', avg: 4.8, min: 2, max: 12, median: 4, sla: 5, slaExceeded: false },
  { from: 'Negotiation', to: 'Won', avg: 7.5, min: 3, max: 20, median: 6, sla: 10, slaExceeded: false },
];

// Dummy Stage Aging Analytics Data
export const DUMMY_AGING_DATA = [
  { stage: 'New', avgAge: 1.5, youngest: 0, oldest: 5, sla: 2, exceededCount: 12 },
  { stage: 'Contacted', avgAge: 4.2, youngest: 1, oldest: 15, sla: 3, exceededCount: 45 },
  { stage: 'Site Visit', avgAge: 2.8, youngest: 1, oldest: 10, sla: 5, exceededCount: 8 },
  { stage: 'Quotation', avgAge: 8.5, youngest: 2, oldest: 25, sla: 7, exceededCount: 65 },
  { stage: 'Negotiation', avgAge: 14.2, youngest: 5, oldest: 45, sla: 10, exceededCount: 120 },
];

// Dummy Response Time Analytics Data
export const DUMMY_RESPONSE_TIME_DATA = [
  { from: 'Lead Created', to: 'First Contact', avg: '2.5 hrs', avgRaw: 2.5, min: '5 mins', max: '1.2 days', median: '1.5 hrs', sla: '4 hrs', lateCount: 15, slaExceeded: false },
  { from: 'First Contact', to: 'First Meeting', avg: '1.5 days', avgRaw: 36, min: '2 hrs', max: '4 days', median: '1 day', sla: '2 days', lateCount: 8, slaExceeded: false },
  { from: 'First Meeting', to: 'Quotation', avg: '3.2 days', avgRaw: 76.8, min: '1 day', max: '8 days', median: '2.5 days', sla: '3 days', lateCount: 22, slaExceeded: true },
  { from: 'Quotation', to: 'Negotiation', avg: '4.5 days', avgRaw: 108, min: '2 days', max: '12 days', median: '4 days', sla: '5 days', lateCount: 12, slaExceeded: false },
  { from: 'Negotiation', to: 'Won', avg: '8.2 days', avgRaw: 196.8, min: '3 days', max: '25 days', median: '6 days', sla: '7 days', lateCount: 30, slaExceeded: true },
];

export const DUMMY_RESPONSE_TREND_DATA = [
  { month: 'Jan', avgHours: 5.2 },
  { month: 'Feb', avgHours: 4.8 },
  { month: 'Mar', avgHours: 3.5 },
  { month: 'Apr', avgHours: 3.8 },
  { month: 'May', avgHours: 2.9 },
  { month: 'Jun', avgHours: 2.5 },
];

// Dummy SLA Alerts
export const DUMMY_SLA_ALERTS = [
  { id: 'sla-1', title: 'Overdue Leads', count: 42, icon: '⏱️', severity: 'Critical', actionText: 'Reassign All' },
  { id: 'sla-2', title: 'Late Follow-ups', count: 18, icon: '📞', severity: 'High', actionText: 'Send Reminders' },
  { id: 'sla-3', title: 'Late Quotations', count: 7, icon: '📄', severity: 'Medium', actionText: 'View Pending' },
  { id: 'sla-4', title: 'Missed Calls', count: 12, icon: '📵', severity: 'High', actionText: 'Call Back Now' },
  { id: 'sla-5', title: 'No Activity (>7d)', count: 56, icon: '💤', severity: 'Critical', actionText: 'Run Campaign' },
  { id: 'sla-6', title: 'Site Visit Delays', count: 5, icon: '🏢', severity: 'Low', actionText: 'Follow Up' },
  { id: 'sla-7', title: 'Negotiation Delays', count: 14, icon: '🤝', severity: 'Medium', actionText: 'Review Deals' },
];

// Dummy SLA Dashboard Data
export const DUMMY_SLA_DASHBOARD_DATA = {
  status: [
    { name: 'On Time', value: 350 },
    { name: 'At Risk', value: 85 },
    { name: 'Breached', value: 45 },
  ],
  metrics: {
    avgResolution: '4.2 hrs',
    breachRate: '12.4%',
  }
};

// Dummy Pipeline Velocity Data
export const DUMMY_VELOCITY_DATA = {
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
export const DUMMY_AI_INSIGHTS_DATA = [
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
export const DUMMY_AI_PREDICTION_DATA = {
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
export const DUMMY_MARKETING_DATA = {
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
export const DUMMY_PRODUCTIVITY_DATA = {
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
export const DUMMY_EXECUTIVE_DATA = {
  topPerformer: { name: 'Sarah Smith', stat: '$1.2M Won' },
  lowestPerformer: { name: 'Mike Johnson', stat: '12% Win Rate' },
  biggestDeal: { name: 'Oscorp Lab Refit', stat: '$850k (Neg)' },
  oldestLead: { name: 'Globex Inc Lobby', stat: '142 Days' },
  highestRevSource: { name: 'Referrals', stat: '$2.4M (45%)' },
  highestRevProject: { name: 'Acme Corp Renovations', stat: '$1.8M Closed' },
  mostDelayedStage: { name: 'Negotiation', stat: 'Avg 14.2 Days' },
  criticalAlerts: { count: 12, stat: '8 SLA Breaches' },
  revenueForecast: { value: '$4.5M', stat: 'Q3 Expected' },
  pipelineHealth: { status: 'Good', score: '84/100', color: 'success' }
};

// Dummy Geographic Data
export const DUMMY_GEO_DATA = {
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
export const DUMMY_CUSTOMER_DATA = {
  kpis: {
    repeatCustomers: 450,
    referralCustomers: 210,
    cltv: 125000, // Customer Lifetime Value
    avgProjectValue: 65000,
    repeatPurchaseRate: 18, // %
    revenuePerCustomer: 42000,
  },
  segmentation: [
    { name: 'Enterprise', value: 45, fill: '#8b5cf6' },
    { name: 'Commercial', value: 35, fill: '#3b82f6' },
    { name: 'Residential', value: 15, fill: '#10b981' },
    { name: 'Government', value: 5, fill: '#f59e0b' },
  ],
  topCustomers: [
    { name: 'Oscorp Industries', type: 'Enterprise', projects: 5, lifetimeValue: 2450000, lastPurchase: 'Jun 12, 2026' },
    { name: 'Wayne Enterprises', type: 'Enterprise', projects: 3, lifetimeValue: 1850000, lastPurchase: 'May 04, 2026' },
    { name: 'Central Perk', type: 'Commercial', projects: 2, lifetimeValue: 420000, lastPurchase: 'Jul 01, 2026' },
    { name: 'Stark Tower Mgmt', type: 'Enterprise', projects: 4, lifetimeValue: 3100000, lastPurchase: 'Jan 15, 2026' },
  ]
};

// Dummy Financial Analytics Data
export const DUMMY_FINANCIAL_DATA = {
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
export const DUMMY_FORECAST_DATA = {
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

