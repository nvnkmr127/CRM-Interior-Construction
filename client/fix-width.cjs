const fs = require('fs');
let code = fs.readFileSync('d:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx', 'utf8');
code = code.replace(
  'import { Responsive, WidthProvider } from "react-grid-layout";',
  'import { Responsive, WidthProvider } from "react-grid-layout/dist/legacy.mjs";'
);
code = code.replace(
  "import { Responsive, WidthProvider } from 'react-grid-layout';",
  "import { Responsive, WidthProvider } from 'react-grid-layout/dist/legacy.mjs';"
);
fs.writeFileSync('d:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx', code);
