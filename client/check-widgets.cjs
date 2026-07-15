const fs = require('fs');
const content = fs.readFileSync('d:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx', 'utf8');
const widgets = ['lead_kpis', 'funnel', 'revenue_kpis', 'revenue_charts', 'sales_cycle', 'pipeline_vel', 'lost_leads', 'win_rate', 'sla', 'ai_revenue', 'ai_predict', 'sales_prod', 'marketing', 'geo', 'customer', 'financial', 'forecast', 'executive', 'goal_tracking', 'benchmark_analytics'];
const found = widgets.filter(w => content.includes('key="' + w + '"'));
const missing = widgets.filter(w => !content.includes('key="' + w + '"'));
console.log('Found:', found);
console.log('Missing:', missing);
