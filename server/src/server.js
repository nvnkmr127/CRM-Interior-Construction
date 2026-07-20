const config = require('./config/env');
const app = require('./app');
const { startQueuePolling } = require('./queues/automationQueue');
const { startPdfWorker } = require('./queues/pdfWorker');
const { startSlaTracking } = require('./services/automation/slaTracker');
require('./queues/workers/aiWorker');
require('./queues/workers/cronWorker');


const { validateEnvironmentSecrets } = require('./utils/secretValidator');
const PORT = config.port;

// Enterprise Security: Validate environment variable cryptographic strength
validateEnvironmentSecrets();

const pool = require('./config/db');
const fs = require('fs');
const sql = fs.readFileSync('migrations/006_financial_approval_attachments.sql', 'utf8') + ';' + fs.readFileSync('migrations/007_extend_approvals_bulk.sql', 'utf8') + ';' + fs.readFileSync('migrations/008_approval_assignment.sql', 'utf8') + ';' + fs.readFileSync('migrations/009_sla_tracking.sql', 'utf8') + ';' + fs.readFileSync('migrations/010_approval_priority.sql', 'utf8');
pool.query(sql).then(() => console.log('Migration 006 OK')).catch(e => console.log(e));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startQueuePolling();
  startPdfWorker();
  startSlaTracking();
});
