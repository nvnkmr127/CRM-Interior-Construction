const fs = require('fs');
let content = fs.readFileSync('server/src/app.js', 'utf8');

content = content.replace(
  "const offboardingRoutes = require('./routes/offboarding');", 
  "const offboardingRoutes = require('./routes/offboarding');\nconst superadminRoutes = require('./routes/superadmin');"
);

content = content.replace(
  "app.use('/api/offboarding', offboardingRoutes);", 
  "app.use('/api/offboarding', offboardingRoutes);\napp.use('/api/superadmin', superadminRoutes);"
);

fs.writeFileSync('server/src/app.js', content, 'utf8');
console.log('Mounted superadmin');
