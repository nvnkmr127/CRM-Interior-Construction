const { execSync } = require('child_process');
try {
  execSync('git restore "client/src/components/leads/LeadDrawer.jsx"');
  console.log('Successfully restored LeadDrawer.jsx');
} catch (e) {
  console.error('Failed to restore:', e);
}
