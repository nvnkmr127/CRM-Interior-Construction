const cp = require('child_process');
try {
  const output = cp.execSync('git show 1a1585172b5a4416dcf02830fdc250ad49951b7e:client/src/pages/analytics/LeadAnalyticsPage.jsx').toString();
  const widgets = ['lead_kpis', 'funnel', 'revenue_kpis', 'revenue_charts', 'sales_cycle', 'pipeline_vel', 'lost_leads', 'win_rate', 'sla', 'ai_revenue', 'ai_predict', 'sales_prod', 'marketing', 'geo', 'customer', 'financial', 'forecast', 'executive'];
  const missing = widgets.filter(w => !output.includes('key="' + w + '"'));
  console.log('Missing in 1a15851:', missing);
} catch (e) {
  console.log(e);
}
