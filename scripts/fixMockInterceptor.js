const fs = require('fs');
let c = fs.readFileSync('client/src/api/mockInterceptor.js', 'utf8');
c = c.replace('\\n          else if (isMutation) {', '          else if (isMutation) {');
fs.writeFileSync('client/src/api/mockInterceptor.js', c);
console.log('Done');
