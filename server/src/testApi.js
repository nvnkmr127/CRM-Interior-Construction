const path = require('path');
const { execSync } = require('child_process');
try {
  const out = execSync('node -e "const axios = require(\'axios\'); axios.post(\'http://127.0.0.1:4000/api/auth/login\', {email:\'admin@demo.com\', password:\'Demo@123\', tenantSlug:\'demo\'}).then(res=>console.log(res.data)).catch(e=>console.log(\'AXIOS ERROR:\', e.message))"', { 
    cwd: path.resolve(__dirname, '../../server')
  });
  console.log('Output:', out.toString());
} catch (e) {
  console.log('Error:', e.message);
}
