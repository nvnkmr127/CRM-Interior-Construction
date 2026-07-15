const fs = require('fs');
const files = [
  'RevenueKPIsWidget.jsx',
  'RevenueChartsWidget.jsx',
  'PipelineVelocityWidget.jsx',
  'RevenueForecastWidget.jsx'
];
files.forEach(f => {
  const filePath = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/components/analytics/' + f;
  let code = fs.readFileSync(filePath, 'utf8');
  code = code.replace(/import\s*\{\s*data\s*\}\s*from\s*['"].*?dummyAnalyticsData['"];\r?\n/g, '');
  fs.writeFileSync(filePath, code);
  console.log('Removed import from ' + f);
});
