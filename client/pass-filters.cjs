const fs = require('fs');
const file = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx';
let content = fs.readFileSync(file, 'utf8');

const widgetsMap = {
  'lead_kpis': '<LeadKPIsWidget filters={filters} />',
  'funnel': '<FunnelChart filters={filters} />',
  'revenue_kpis': '<RevenueKPIsWidget filters={filters} />',
  'revenue_charts': '<RevenueChartsWidget filters={filters} />',
  'sales_cycle': '<SalesCycleWidget filters={filters} />',
  'pipeline_vel': '<PipelineVelocityWidget filters={filters} />',
  'lost_leads': '<LostReasonsChart filters={filters} />',
  'win_rate': '<RepLeaderboard filters={filters} />',
  'sla': '<SLADashboardWidget filters={filters} />',
  'ai_revenue': '<AIRevenueInsightsWidget filters={filters} />',
  'ai_predict': '<AIPredictionWidget filters={filters} />',
  'sales_prod': '<SalesProductivityWidget filters={filters} />',
  'marketing': '<MarketingAnalyticsWidget filters={filters} />',
  'geo': '<GeographicWidget filters={filters} />',
  'customer': '<CustomerAnalyticsWidget filters={filters} />',
  'financial': '<FinancialAnalyticsWidget filters={filters} />',
  'forecast': '<RevenueForecastWidget filters={filters} />',
  'executive': '<ExecutiveSummaryWidget filters={filters} />'
};

// Rebuild widgetsJSX inside the script and replace
let widgetsJSX = '';
for (const [key, comp] of Object.entries(widgetsMap)) {
  widgetsJSX += `
{layout.some(l => l.i === '${key}') && (
  <div key="${key}">
    <WidgetContainer id="${key}" isEditMode={isEditMode} layout={layout} setLayout={setLayout}>
      ${comp}
    </WidgetContainer>
  </div>
)}
`;
}

// Find where the old widgets JSX starts
const startIndex = content.indexOf('{layout.some(l => l.i === \'lead_kpis\') && (');
if (startIndex !== -1) {
  // It ends before goal_tracking or </ResponsiveGridLayout>
  let endIndex = content.indexOf('{layout.some(l => l.i === \'goal_tracking\') && (');
  if (endIndex === -1) endIndex = content.indexOf('</ResponsiveGridLayout>');
  
  if (endIndex !== -1) {
    content = content.substring(0, startIndex) + widgetsJSX + content.substring(endIndex);
    fs.writeFileSync(file, content);
    console.log('Passed filters to all 18 widgets in LeadAnalyticsPage.jsx!');
  } else {
    console.log('Could not find end index');
  }
} else {
  console.log('Could not find start index');
}
