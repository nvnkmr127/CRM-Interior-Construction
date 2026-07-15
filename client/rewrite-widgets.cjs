const fs = require('fs');
const path = require('path');
const dir = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/components/analytics';

const widgetsConfig = {
  'LeadKPIsWidget.jsx': { endpoint: 'getLeadSummary' },
  'FunnelChart.jsx': { endpoint: 'getLeadFunnel', isExisting: true },
  'LostReasonsChart.jsx': { endpoint: 'getLostReasons', isExisting: true },
  'RepLeaderboard.jsx': { endpoint: 'getRepPerformance', isExisting: true },
  'RevenueKPIsWidget.jsx': { endpoint: 'getRevenue' },
  'RevenueChartsWidget.jsx': { endpoint: 'getRevenue' },
  'PipelineVelocityWidget.jsx': { endpoint: 'getPipeline' },
  'RevenueForecastWidget.jsx': { endpoint: 'getForecast' },
  'SalesCycleWidget.jsx': { dummy: true },
  'SLADashboardWidget.jsx': { dummy: true },
  'AIRevenueInsightsWidget.jsx': { dummy: true },
  'AIPredictionWidget.jsx': { dummy: true },
  'SalesProductivityWidget.jsx': { dummy: true },
  'MarketingAnalyticsWidget.jsx': { dummy: true },
  'GeographicWidget.jsx': { dummy: true },
  'CustomerAnalyticsWidget.jsx': { dummy: true },
  'FinancialAnalyticsWidget.jsx': { dummy: true },
  'ExecutiveSummaryWidget.jsx': { dummy: true },
};

Object.entries(widgetsConfig).forEach(([file, config]) => {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');

  // Skip if already refactored
  if (content.includes('useState')) return;

  let imports = `import React, { useState, useEffect } from 'react';\n`;
  if (config.endpoint) {
    imports += `import { ${config.endpoint} } from '../../api/analytics';\n`;
  }
  
  // Replace the React import
  content = content.replace(/import React[^;]*;/, imports.trim());

  // Component signature
  const funcRegex = /(export default function [A-Za-z0-9_]+)\(\s*([^)]*)\s*\)\s*\{/;
  
  content = content.replace(funcRegex, (match, def, props) => {
    let newProps = props;
    if (!props.includes('filters')) {
      if (props === '') newProps = '{ filters }';
      else if (props.includes('{')) newProps = props.replace('{', '{ filters, ');
      else newProps = `props`;
    }
    
    let injectedHooks = `
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
`;

    if (config.dummy) {
      injectedHooks += `
    const USE_DUMMY_FALLBACK = true;
    console.warn('${file.replace('.jsx', '')} is using dummy data fallback.');
    
    // Simulate network delay
    setTimeout(() => {
      if (!isMounted) return;
      setLoading(false);
      // Data is imported directly from dummyAnalyticsData
    }, 800);
`;
    } else {
      injectedHooks += `
    ${config.endpoint}(filters)
      .then(res => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          setError(err.message || 'Failed to load data');
          setLoading(false);
        }
      });
`;
    }

    injectedHooks += `
    return () => { isMounted = false; };
  }, [filters]);

  if (loading) return <div style={{ padding: '16px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>Loading...</div>;
  if (error) return <div style={{ padding: '16px', color: 'var(--color-danger)', textAlign: 'center' }}>{error}</div>;
`;

    // For existing charts that took data as a prop, we no longer need the prop if we fetched it, 
    // but wait, if it's dummy, it doesn't fetch.
    if (config.isExisting && !config.dummy) {
       // We fetched `data`, so we just let the rest of the component use it!
    } else if (config.dummy && config.isExisting) {
       // Wait, `LeadAnalyticsPage.jsx` passes `data={DUMMY_FUNNEL_DATA}` to FunnelChart.
       // If FunnelChart uses `data` from props, we don't need to fetch. 
       // But user said: "replace DUMMY_* constants... with real data fetched from the backend. The following endpoints exist... wire them in via useEffect"
       // We MUST fetch data from backend inside FunnelChart!
    }

    return `${def}(${newProps}) {\n${injectedHooks}`;
  });

  // If it's a real endpoint and we have `data` state, we might need to replace `DUMMY_*` references with `data`.
  if (config.endpoint) {
    content = content.replace(/DUMMY_[A-Z_]+/g, 'data');
    // Remove the import of dummy data
    content = content.replace(/import\s*\{\s*DUMMY_[A-Z_]+\s*\}\s*from\s*'[^']+';?\n?/g, '');
  }

  fs.writeFileSync(filePath, content);
});

console.log('Successfully refactored widgets to use useEffect and loading/error states!');
