const fs = require('fs');
const code = fs.readFileSync('server/src/app.js', 'utf8');
const reqRegex = /require\(['"](\.\/routes\/.*?)['"]\)/g;
let match;
const missing = [];
while((match = reqRegex.exec(code)) !== null) {
  const routeName = match[1].replace('./', '');
  const p = 'server/src/' + routeName + '.js';
  const p2 = 'server/src/' + routeName + '/index.js';
  if(!fs.existsSync(p) && !fs.existsSync(p2)) missing.push(match[1]);
}
console.log('Missing routes required by app.js:', missing);
