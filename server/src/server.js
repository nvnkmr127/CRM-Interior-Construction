const config = require('./config/env');
const app = require('./app');
const { startQueuePolling } = require('./queues/automationQueue');
const { startPdfWorker } = require('./queues/pdfWorker');

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startQueuePolling();
  startPdfWorker();
});
