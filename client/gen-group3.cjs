const fs = require('fs');
const path = require('path');
const dir = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/components/analytics';

const components = {
  'AIRevenueInsightsWidget.jsx': `
import React from 'react';
import { DUMMY_AI_INSIGHTS_DATA } from '../../data/dummyAnalyticsData';

export default function AIRevenueInsightsWidget() {
  return (
    <div style={{ padding: '16px', height: '100%', overflowY: 'auto' }}>
      {DUMMY_AI_INSIGHTS_DATA.map((insight, i) => (
        <div key={i} style={{ padding: '12px', background: 'var(--color-surface-2)', borderRadius: '8px', marginBottom: '12px', borderLeft: \`4px solid \${insight.type === 'positive' ? 'var(--color-success)' : insight.type === 'negative' ? 'var(--color-danger)' : 'var(--color-accent)'}\` }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>{insight.title}</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{insight.desc}</div>
        </div>
      ))}
    </div>
  );
}`,
  'AIPredictionWidget.jsx': `
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DUMMY_AI_PREDICTION_DATA } from '../../data/dummyAnalyticsData';

export default function AIPredictionWidget() {
  return (
    <div style={{ height: '100%', width: '100%', padding: '16px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={DUMMY_AI_PREDICTION_DATA}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="month" stroke="var(--color-text-secondary)" />
          <YAxis stroke="var(--color-text-secondary)" />
          <Tooltip contentStyle={{ background: 'var(--color-surface-2)', border: 'none', borderRadius: '8px' }} />
          <Area type="monotone" dataKey="predicted" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}`,
  'SalesProductivityWidget.jsx': `
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DUMMY_PRODUCTIVITY_DATA } from '../../data/dummyAnalyticsData';

export default function SalesProductivityWidget() {
  return (
    <div style={{ height: '100%', width: '100%', padding: '16px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={DUMMY_PRODUCTIVITY_DATA}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="rep" stroke="var(--color-text-secondary)" />
          <YAxis stroke="var(--color-text-secondary)" />
          <Tooltip contentStyle={{ background: 'var(--color-surface-2)', border: 'none', borderRadius: '8px' }} />
          <Legend />
          <Bar dataKey="calls" stackId="a" fill="#3b82f6" />
          <Bar dataKey="emails" stackId="a" fill="#10b981" />
          <Bar dataKey="meetings" stackId="a" fill="#8b5cf6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}`,
  'RevenueForecastWidget.jsx': `
import React from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DUMMY_FORECAST_DATA } from '../../data/dummyAnalyticsData';

export default function RevenueForecastWidget() {
  return (
    <div style={{ height: '100%', width: '100%', padding: '16px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={DUMMY_FORECAST_DATA}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="qtr" stroke="var(--color-text-secondary)" />
          <YAxis stroke="var(--color-text-secondary)" />
          <Tooltip contentStyle={{ background: 'var(--color-surface-2)', border: 'none', borderRadius: '8px' }} />
          <Legend />
          <Bar dataKey="actual" fill="#10b981" />
          <Line type="monotone" dataKey="projected" stroke="#8b5cf6" strokeWidth={3} strokeDasharray="5 5" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}`
};

Object.entries(components).forEach(([name, content]) => {
  fs.writeFileSync(path.join(dir, name), content.trim());
});
console.log('Group 3 generated!');
