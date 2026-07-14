const fs = require('fs');
const file = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('GoalTrackingWidget')) {
  // 1. Add import
  content = content.replace(
    "import AnalyticsAlertsPanel from '../../components/analytics/AnalyticsAlertsPanel';",
    "import AnalyticsAlertsPanel from '../../components/analytics/AnalyticsAlertsPanel';\nimport GoalTrackingWidget from '../../components/analytics/GoalTrackingWidget';"
  );

  // 2. Add to layout
  content = content.replace(
    "{ i: 'executive', x: 0, y: 69, w: 12, h: 6, minW: 6, minH: 5 }",
    "{ i: 'executive', x: 0, y: 69, w: 12, h: 6, minW: 6, minH: 5 },\n  { i: 'goal_tracking', x: 0, y: 75, w: 12, h: 6, minW: 4, minH: 4 }"
  );

  // 3. Add to presets
  content = content.replace(
    "['executive', 'revenue_kpis', 'ai_revenue', 'forecast'].includes(l.i)",
    "['executive', 'revenue_kpis', 'ai_revenue', 'forecast', 'goal_tracking'].includes(l.i)"
  );
  content = content.replace(
    "['marketing', 'lead_kpis', 'funnel', 'geo'].includes(l.i)",
    "['marketing', 'lead_kpis', 'funnel', 'geo', 'goal_tracking'].includes(l.i)"
  );

  // 4. Add to JSX render
  content = content.replace(
    '</ResponsiveGridLayout>',
    `{layout.some(l => l.i === 'goal_tracking') && (
  <div key="goal_tracking">
    <GoalTrackingWidget onClick={handleCardClick} />
  </div>
)}
      </ResponsiveGridLayout>`
  );

  fs.writeFileSync(file, content);
  console.log('Successfully injected Goal Tracking module');
} else {
  console.log('Already injected');
}
