const fs = require('fs');
const path = require('path');
const dir = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/components/analytics';

const components = {
  'LeadKPIsWidget.jsx': `
import React from 'react';

export default function LeadKPIsWidget() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', padding: '16px', height: '100%' }}>
      {[{label: 'Total Leads', val: '1,204'}, {label: 'Won', val: '342'}, {label: 'Win Rate', val: '28.4%'}, {label: 'Avg Score', val: '86'}].map(k => (
        <div key={k.label} style={{ background: 'var(--color-surface-2)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: '8px' }}>{k.label}</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{k.val}</div>
        </div>
      ))}
    </div>
  );
}`,
  'RevenueKPIsWidget.jsx': `
import React from 'react';
import { DUMMY_REVENUE_DATA } from '../../data/dummyAnalyticsData';

export default function RevenueKPIsWidget() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', padding: '16px', height: '100%' }}>
      <div style={{ background: 'var(--color-surface-2)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: '8px' }}>Total Revenue</div>
        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>$\{(DUMMY_REVENUE_DATA.total / 1000).toFixed(1)}k</div>
      </div>
      <div style={{ background: 'var(--color-surface-2)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: '8px' }}>Pipeline Value</div>
        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>$\{(DUMMY_REVENUE_DATA.pipeline / 1000).toFixed(1)}k</div>
      </div>
      <div style={{ background: 'var(--color-surface-2)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: '8px' }}>Forecast</div>
        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>$\{(DUMMY_REVENUE_DATA.forecast / 1000).toFixed(1)}k</div>
      </div>
      <div style={{ background: 'var(--color-surface-2)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: '8px' }}>Avg Deal Size</div>
        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>$\{(DUMMY_REVENUE_DATA.avgDealSize / 1000).toFixed(1)}k</div>
      </div>
    </div>
  );
}`,
  'RevenueChartsWidget.jsx': `
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DUMMY_REVENUE_DATA } from '../../data/dummyAnalyticsData';

export default function RevenueChartsWidget() {
  return (
    <div style={{ height: '100%', width: '100%', padding: '16px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={DUMMY_REVENUE_DATA.trend}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="month" stroke="var(--color-text-secondary)" />
          <YAxis stroke="var(--color-text-secondary)" />
          <Tooltip contentStyle={{ background: 'var(--color-surface-2)', border: 'none', borderRadius: '8px' }} />
          <Line type="monotone" dataKey="actual" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="target" stroke="#3b82f6" strokeWidth={3} strokeDasharray="5 5" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}`,
  'SalesCycleWidget.jsx': `
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DUMMY_SALES_CYCLE_DATA } from '../../data/dummyAnalyticsData';

export default function SalesCycleWidget() {
  return (
    <div style={{ height: '100%', width: '100%', padding: '16px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={DUMMY_SALES_CYCLE_DATA} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
          <XAxis type="number" stroke="var(--color-text-secondary)" />
          <YAxis dataKey="stage" type="category" stroke="var(--color-text-secondary)" width={100} />
          <Tooltip contentStyle={{ background: 'var(--color-surface-2)', border: 'none', borderRadius: '8px' }} />
          <Bar dataKey="days" fill="#3b82f6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}`,
  'PipelineVelocityWidget.jsx': `
import React from 'react';
import { DUMMY_VELOCITY_DATA } from '../../data/dummyAnalyticsData';

export default function PipelineVelocityWidget() {
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>Overall Velocity</div>
        <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--color-accent)' }}>$\{(DUMMY_VELOCITY_DATA.overall / 1000).toFixed(1)}k/day</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        <div style={{ background: 'var(--color-surface-2)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Leads in Pipe</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{DUMMY_VELOCITY_DATA.metrics.activeLeads}</div>
        </div>
        <div style={{ background: 'var(--color-surface-2)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Win Rate</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{DUMMY_VELOCITY_DATA.metrics.winRate}</div>
        </div>
        <div style={{ background: 'var(--color-surface-2)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Avg Cycle</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{DUMMY_VELOCITY_DATA.metrics.avgCycle}</div>
        </div>
      </div>
    </div>
  );
}`,
  'SLADashboardWidget.jsx': `
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { DUMMY_SLA_DASHBOARD_DATA } from '../../data/dummyAnalyticsData';

const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

export default function SLADashboardWidget() {
  return (
    <div style={{ height: '100%', width: '100%', padding: '16px', display: 'flex' }}>
      <div style={{ flex: 1 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={DUMMY_SLA_DASHBOARD_DATA.status} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
              {DUMMY_SLA_DASHBOARD_DATA.status.map((entry, index) => (
                <Cell key={\`cell-\${index}\`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: 'var(--color-surface-2)', border: 'none', borderRadius: '8px' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Avg Resolution</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{DUMMY_SLA_DASHBOARD_DATA.metrics.avgResolution}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Breach Rate</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-danger)' }}>{DUMMY_SLA_DASHBOARD_DATA.metrics.breachRate}</div>
        </div>
      </div>
    </div>
  );
}`
};

Object.entries(components).forEach(([name, content]) => {
  fs.writeFileSync(path.join(dir, name), content.trim());
});
console.log('Group 2 generated!');
