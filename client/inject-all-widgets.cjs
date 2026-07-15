const fs = require('fs');
const file = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx';
let content = fs.readFileSync(file, 'utf8');

const imports = `
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
`;

if (!content.includes('LeadKPIsWidget')) {
  // Inject imports at the top, right after GoalTrackingWidget
  content = content.replace("import GoalTrackingWidget from '../../components/analytics/GoalTrackingWidget';", "import GoalTrackingWidget from '../../components/analytics/GoalTrackingWidget';" + imports);
}

const widgetsMap = {
  'lead_kpis': '<LeadKPIsWidget />',
  'funnel': '<FunnelChart data={DUMMY_FUNNEL_DATA} />',
  'revenue_kpis': '<RevenueKPIsWidget />',
  'revenue_charts': '<RevenueChartsWidget />',
  'sales_cycle': '<SalesCycleWidget />',
  'pipeline_vel': '<PipelineVelocityWidget />',
  'lost_leads': '<LostReasonsChart data={DUMMY_LOST_DATA} />',
  'win_rate': '<RepLeaderboard />',
  'sla': '<SLADashboardWidget />',
  'ai_revenue': '<AIRevenueInsightsWidget />',
  'ai_predict': '<AIPredictionWidget />',
  'sales_prod': '<SalesProductivityWidget />',
  'marketing': '<MarketingAnalyticsWidget />',
  'geo': '<GeographicWidget />',
  'customer': '<CustomerAnalyticsWidget />',
  'financial': '<FinancialAnalyticsWidget />',
  'forecast': '<RevenueForecastWidget />',
  'executive': '<ExecutiveSummaryWidget />'
};

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

// Inject right before </ResponsiveGridLayout>
if (!content.includes('LeadKPIsWidget />')) {
  content = content.replace('</ResponsiveGridLayout>', widgetsJSX + '</ResponsiveGridLayout>');
}

// Ensure FunnelChart has data passed
// We need to make sure DUMMY_FUNNEL_DATA and DUMMY_LOST_DATA are available. They are imported via dummyAnalyticsData.js!
fs.writeFileSync(file, content);
console.log('Successfully injected all widgets into LeadAnalyticsPage.jsx!');
