const fs = require('fs');
const path = require('path');

const missingPath = path.join(__dirname, 'missing.json');
const stubPath = path.join(__dirname, '../src/routes/stub.js');

const missing = JSON.parse(fs.readFileSync(missingPath, 'utf8'));

// Extract unique base routes (e.g., /config/webhooks from /config/webhooks/:id)
const baseRoutes = new Set();
for (const m of missing) {
  // get the first one or two parts
  const parts = m.split('/').filter(Boolean);
  if (parts.length > 0) {
    if (parts[0] === 'portal' && parts.length > 1) {
      baseRoutes.add(`/${parts[0]}/${parts[1]}`);
    } else if (parts[0] === 'config' && parts.length > 1) {
      baseRoutes.add(`/${parts[0]}/${parts[1]}`);
    } else if (parts[0] === 'projects' && parts.length > 2) {
      baseRoutes.add(`/${parts[0]}/:projectId/${parts[2]}`);
    } else {
      baseRoutes.add(`/${parts[0]}`);
    }
  }
}

let code = `const express = require('express');
const router = express.Router();

// Auto-generated stub router to prevent 404 console errors for incomplete modules
const handleStub = (req, res) => {
  res.status(200).json({
    success: true,
    data: [], // Return empty array by default to satisfy .map() calls
    items: [],
    message: 'Stub response'
  });
};

`;

for (const route of baseRoutes) {
  code += `router.all('${route}*', handleStub);\n`;
}

code += `\nmodule.exports = router;\n`;

fs.writeFileSync(stubPath, code);
console.log('Stub router generated at', stubPath);
