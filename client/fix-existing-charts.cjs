const fs = require('fs');

const files = [
  'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/components/analytics/FunnelChart.jsx',
  'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/components/analytics/LostReasonsChart.jsx',
  'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/components/analytics/RepLeaderboard.jsx'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  // Replace `({ filters,  data })` or similar with `({ filters })`
  content = content.replace(/\{\s*filters,\s*data\s*\}/g, '{ filters }');
  content = content.replace(/\{\s*data\s*\}/g, '{ filters }'); // just in case it missed it
  fs.writeFileSync(f, content);
});
console.log('Fixed props for existing components');

const page = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx';
let pageContent = fs.readFileSync(page, 'utf8');
pageContent = pageContent.replace(/data=\{DUMMY_FUNNEL_DATA\}/g, '');
pageContent = pageContent.replace(/data=\{DUMMY_LOST_DATA\}/g, '');
pageContent = pageContent.replace(/data=\{DUMMY_WIN_RATE_DATA\}/g, '');
fs.writeFileSync(page, pageContent);
console.log('Removed data props from LeadAnalyticsPage');
