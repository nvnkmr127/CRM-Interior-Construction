const fs = require('fs');
const file = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('LeadToProjectOutcomesWidget')) {
  // Inject import at the top
  content = content.replace(
    "import GoalTrackingWidget from '../../components/analytics/GoalTrackingWidget';", 
    "import GoalTrackingWidget from '../../components/analytics/GoalTrackingWidget';\nimport LeadToProjectOutcomesWidget from '../../components/analytics/LeadToProjectOutcomesWidget';"
  );
  
  // Inject component block
  const block = `
{layout.some(l => l.i === 'project_outcomes') && (
  <div key="project_outcomes">
    <WidgetContainer id="project_outcomes" isEditMode={isEditMode} layout={layout} setLayout={setLayout}>
      <LeadToProjectOutcomesWidget filters={filters} />
    </WidgetContainer>
  </div>
)}
`;
  
  content = content.replace('</ResponsiveGridLayout>', block + '</ResponsiveGridLayout>');
  fs.writeFileSync(file, content);
  console.log('Injected LeadToProjectOutcomesWidget into LeadAnalyticsPage.jsx');
}
