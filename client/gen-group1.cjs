const fs = require('fs');
const path = require('path');
const dir = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/components/analytics';

const components = {
  'CustomerAnalyticsWidget.jsx': `
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { DUMMY_CUSTOMER_DATA } from '../../data/dummyAnalyticsData';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function CustomerAnalyticsWidget() {
  return (
    <div style={{ height: '100%', width: '100%', padding: '16px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={DUMMY_CUSTOMER_DATA} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
            {DUMMY_CUSTOMER_DATA.map((entry, index) => (
              <Cell key={\`cell-\${index}\`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: 'var(--color-surface-2)', border: 'none', borderRadius: '8px' }} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}`,
  'FinancialAnalyticsWidget.jsx': `
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DUMMY_FINANCIAL_DATA } from '../../data/dummyAnalyticsData';

export default function FinancialAnalyticsWidget() {
  return (
    <div style={{ height: '100%', width: '100%', padding: '16px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={DUMMY_FINANCIAL_DATA}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="month" stroke="var(--color-text-secondary)" />
          <YAxis stroke="var(--color-text-secondary)" />
          <Tooltip contentStyle={{ background: 'var(--color-surface-2)', border: 'none', borderRadius: '8px' }} />
          <Area type="monotone" dataKey="revenue" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
          <Area type="monotone" dataKey="expenses" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}`,
  'MarketingAnalyticsWidget.jsx': `
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DUMMY_MARKETING_DATA } from '../../data/dummyAnalyticsData';

export default function MarketingAnalyticsWidget() {
  return (
    <div style={{ height: '100%', width: '100%', padding: '16px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={DUMMY_MARKETING_DATA} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
          <XAxis type="number" stroke="var(--color-text-secondary)" />
          <YAxis dataKey="campaign" type="category" stroke="var(--color-text-secondary)" width={100} />
          <Tooltip contentStyle={{ background: 'var(--color-surface-2)', border: 'none', borderRadius: '8px' }} />
          <Bar dataKey="leads" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}`,
  'GeographicWidget.jsx': `
import React from 'react';
import { DUMMY_GEO_DATA } from '../../data/dummyAnalyticsData';

export default function GeographicWidget() {
  return (
    <div style={{ padding: '16px', overflowY: 'auto', height: '100%' }}>
      {DUMMY_GEO_DATA.map((loc, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{loc.region}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{loc.leads} Leads</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>$\{(loc.value / 1000).toFixed(1)}k</div>
            <div style={{ fontSize: '12px', color: 'var(--color-success)' }}>{loc.growth}</div>
          </div>
        </div>
      ))}
    </div>
  );
}`,
  'ExecutiveSummaryWidget.jsx': `
import React from 'react';
import { DUMMY_EXECUTIVE_DATA } from '../../data/dummyAnalyticsData';

export default function ExecutiveSummaryWidget() {
  return (
    <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', height: '100%', overflowY: 'auto' }}>
      {Object.entries(DUMMY_EXECUTIVE_DATA).map(([key, item]) => (
        <div key={key} style={{ background: 'var(--color-surface-2)', padding: '16px', borderRadius: '8px' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '8px', textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>{item.value}</div>
          <div style={{ fontSize: '12px', color: item.trend.startsWith('+') ? 'var(--color-success)' : 'var(--color-danger)' }}>{item.trend} vs last month</div>
        </div>
      ))}
    </div>
  );
}`
};

Object.entries(components).forEach(([name, content]) => {
  fs.writeFileSync(path.join(dir, name), content.trim());
});
console.log('Group 1 generated!');
