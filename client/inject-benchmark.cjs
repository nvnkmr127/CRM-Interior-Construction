const fs = require('fs');
const file = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('BenchmarkAnalyticsWidget')) {
  // 1. Add import
  content = content.replace(
    "import GoalTrackingWidget from '../../components/analytics/GoalTrackingWidget';",
    "import GoalTrackingWidget from '../../components/analytics/GoalTrackingWidget';\nimport BenchmarkAnalyticsWidget from '../../components/analytics/BenchmarkAnalyticsWidget';"
  );

  // 2. Add to layout
  content = content.replace(
    "{ i: 'goal_tracking', x: 0, y: 75, w: 12, h: 6, minW: 4, minH: 4 }",
    "{ i: 'goal_tracking', x: 0, y: 75, w: 12, h: 6, minW: 4, minH: 4 },\n  { i: 'benchmark_analytics', x: 0, y: 81, w: 12, h: 6, minW: 6, minH: 5 }"
  );

  // 3. Add to presets
  content = content.replace(
    "['executive', 'revenue_kpis', 'ai_revenue', 'forecast', 'goal_tracking'].includes(l.i)",
    "['executive', 'revenue_kpis', 'ai_revenue', 'forecast', 'goal_tracking', 'benchmark_analytics'].includes(l.i)"
  );
  content = content.replace(
    "['marketing', 'lead_kpis', 'funnel', 'geo', 'goal_tracking'].includes(l.i)",
    "['marketing', 'lead_kpis', 'funnel', 'geo', 'goal_tracking', 'benchmark_analytics'].includes(l.i)"
  );

  // 4. Add to JSX render
  content = content.replace(
    '</ResponsiveGridLayout>',
    `{layout.some(l => l.i === 'benchmark_analytics') && (
  <div key="benchmark_analytics">
    <BenchmarkAnalyticsWidget onClick={handleCardClick} />
  </div>
)}
      </ResponsiveGridLayout>`
  );

  fs.writeFileSync(file, content);
  console.log('Successfully injected Benchmark Analytics module');
} else {
  console.log('Already injected');
}
