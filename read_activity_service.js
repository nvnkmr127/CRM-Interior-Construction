const fs = require('fs');
const content = fs.readFileSync('server/src/services/activities/activityService.js', 'utf8');
fs.writeFileSync('server/src/services/activities/activityService_output.txt', content);
