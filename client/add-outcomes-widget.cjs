const fs = require('fs');
const file = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/components/analytics/WidgetLibraryModal.jsx';
let content = fs.readFileSync(file, 'utf8');
if (!content.includes('project_outcomes')) {
  content = content.replace(
    /\{\s*id:\s*'benchmark_analytics'[^}]*\}\s*\]/g,
    "{ id: 'benchmark_analytics', title: 'Benchmark Analytics', desc: 'Compare performance across time, branches, or employees.' },\n  { id: 'project_outcomes', title: 'Lead-to-Project Outcomes', desc: 'Track won lead profitability, CSAT, and snags.' }\n]"
  );
  fs.writeFileSync(file, content);
  console.log('Added project_outcomes to WidgetLibraryModal.jsx');
}
