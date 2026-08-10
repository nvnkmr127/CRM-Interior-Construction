const fs = require('fs');
const path = require('path');

const serverRoutesDir = path.join('server', 'src', 'routes');
const clientApiDir = path.join('client', 'src', 'api');

const serverRoutes = fs.readdirSync(serverRoutesDir).filter(f => f.endsWith('.js') && fs.statSync(path.join(serverRoutesDir, f)).isFile()).map(f => f.replace('.js', ''));
const clientApis = fs.readdirSync(clientApiDir).filter(f => f.endsWith('.js') && fs.statSync(path.join(clientApiDir, f)).isFile()).map(f => f.replace('.js', ''));

const missingInClient = serverRoutes.filter(r => !clientApis.includes(r));
const missingInServer = clientApis.filter(a => !serverRoutes.includes(a) && a !== 'index' && a !== 'axios' && a !== 'config' && a !== 'mockData' && a !== 'mockInterceptor');

fs.writeFileSync('scratch_result.json', JSON.stringify({ missingInClient, missingInServer }, null, 2));
