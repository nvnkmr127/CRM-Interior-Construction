const fs = require('fs');
let code = fs.readFileSync('d:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx', 'utf8');

code = code.replace(/<GoalTrackingWidget onClick=\{handleCardClick\} \/>/g, 
  '<WidgetContainer id="goal_tracking" isEditMode={isEditMode} layout={layout} setLayout={setLayout}>\n      <GoalTrackingWidget />\n    </WidgetContainer>'
);

code = code.replace(/<BenchmarkAnalyticsWidget onClick=\{handleCardClick\} \/>/g, 
  '<WidgetContainer id="benchmark_analytics" isEditMode={isEditMode} layout={layout} setLayout={setLayout}>\n      <BenchmarkAnalyticsWidget />\n    </WidgetContainer>'
);

fs.writeFileSync('d:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx', code);
