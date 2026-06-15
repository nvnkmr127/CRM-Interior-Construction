const config = require('./config/env');
const app = require('./app');
const { startQueuePolling } = require('./queues/automationQueue');

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startQueuePolling();
});
