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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startQueuePolling();
  startPdfWorker();
  startSlaTracking();
});
