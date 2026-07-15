const fs = require('fs');
const file = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/App.jsx';
let content = fs.readFileSync(file, 'utf8');

const oldLine = "const LeadAnalytics  = lazy(() => import('./pages/LeadAnalyticsDashboard'))";
const newLine = "const LeadAnalytics  = lazy(() => import('./pages/analytics/LeadAnalyticsPage'))";

if (content.includes(oldLine)) {
  content = content.replace(oldLine, newLine);
  fs.writeFileSync(file, content);
  console.log('App.jsx updated!');
} else {
  console.log('Line not found');
}
