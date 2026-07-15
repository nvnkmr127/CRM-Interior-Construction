const fs = require('fs');
let code = fs.readFileSync('d:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx', 'utf8');

code = code.replace(
  'import { Responsive, WidthProvider } from "react-grid-layout/dist/legacy.mjs";',
  'import { Responsive, WidthProvider } from "react-grid-layout/legacy";'
);
code = code.replace(
  "import { Responsive, WidthProvider } from 'react-grid-layout/dist/legacy.mjs';",
  "import { Responsive, WidthProvider } from 'react-grid-layout/legacy';"
);

fs.writeFileSync('d:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx', code);
