const fs = require('fs');
let code = fs.readFileSync('d:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx', 'utf8');

// 1. Remove duplicate imports
const targetStr1 = `import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'`;
const replaceStr1 = `import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'`;

const targetStr2 = `import { useState, useEffect } from 'react'\r
import { useNavigate } from 'react-router-dom'\r
import { useState, useEffect } from 'react'\r
import { useNavigate } from 'react-router-dom'`;
const replaceStr2 = `import { useState, useEffect } from 'react'\r
import { useNavigate } from 'react-router-dom'`;

if (code.includes(targetStr1)) {
  code = code.replace(targetStr1, replaceStr1);
} else if (code.includes(targetStr2)) {
  code = code.replace(targetStr2, replaceStr2);
}

// 2. Add Edit Dashboard button safely
const controlsRegex = /<div className=\{styles\.controls\}>\s*<Select\s*value=\{filters\.date\}/;
if (controlsRegex.test(code)) {
  code = code.replace(
    controlsRegex,
    `<div className={styles.controls}>\n          {!isEditMode && (\n            <button className={styles.rangePillActive} onClick={() => setIsEditMode(true)}>\n              Edit Dashboard\n            </button>\n          )}\n          <Select\n            value={filters.date}`
  );
  console.log('Added Edit Dashboard button');
} else {
  console.log('Controls block not found!');
}

// 3. Inject LeadToProjectOutcomesWidget at the bottom
if (!code.includes('project_outcomes') && code.includes('</ResponsiveGridLayout>')) {
  const widgetBlock = `
{layout.some(l => l.i === 'project_outcomes') && (
  <div key="project_outcomes">
    <WidgetContainer id="project_outcomes" isEditMode={isEditMode} layout={layout} setLayout={setLayout}>
      <LeadToProjectOutcomesWidget filters={filters} />
    </WidgetContainer>
  </div>
)}
      </ResponsiveGridLayout>`;
  code = code.replace('      </ResponsiveGridLayout>', widgetBlock);
  console.log('Injected project outcomes widget');
}

fs.writeFileSync('d:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx', code);
console.log('Saved LeadAnalyticsPage.jsx');
