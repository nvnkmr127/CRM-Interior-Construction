const config = require('./config/env');
const app = require('./app');
const { startQueuePolling } = require('./queues/automationQueue');
const { startPdfWorker } = require('./queues/pdfWorker');
const { startSlaTracking } = require('./services/automation/slaTracker');

app.use('/api/communications', require('./routes/communications'));
app.use('/api/portal/project', require('./routes/portal/project'));
app.use('/api/site-visits', require('./routes/siteVisits'));
app.use('/api/search', require('./routes/search'));

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startQueuePolling();
  startPdfWorker();
  startSlaTracking();
});
