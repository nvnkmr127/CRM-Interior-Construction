const { execSync } = require('child_process');
try {
  execSync('git checkout server/src/routes/projects.js', { stdio: 'inherit' });
  console.log('Restored projects.js successfully.');
} catch (e) {
  console.error('Failed to restore:', e);
}
