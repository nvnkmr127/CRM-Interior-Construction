const path = require('path');
const { execSync } = require('child_process');
try {
  console.log('Starting server.js...');
  const out = execSync('node src/server.js', { 
    cwd: path.resolve(__dirname, '../../server'),
    stdio: 'pipe',
    timeout: 5000 // Run for 5 seconds to see if it crashes
  });
  console.log('Output:', out.toString());
} catch (e) {
  console.error('Server crashed with error!');
  console.error('Stdout:', e.stdout ? e.stdout.toString() : '');
  console.error('Stderr:', e.stderr ? e.stderr.toString() : '');
}
