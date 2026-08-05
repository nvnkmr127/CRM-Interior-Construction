const { execSync } = require('child_process');
try {
  const status = execSync('git status', { encoding: 'utf8' });
  require('fs').writeFileSync('git_status_output.txt', status);
} catch (e) {
  require('fs').writeFileSync('git_status_output.txt', 'error: ' + e.message);
}
