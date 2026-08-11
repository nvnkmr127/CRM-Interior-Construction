const config = require('./config/env');



















const app = require('./app');
const { startQueuePolling } = require('./queues/automationQueue');
const { startPdfWorker } = require('./queues/pdfWorker');
const { startSlaTracking } = require('./services/automation/slaTracker');
require('./queues/workers/aiWorker');
require('./queues/workers/cronWorker');
const { startWorker: startEmailQueue } = require('./services/emailService');
const { startCronJobs } = require('./services/cronService');


const { validateEnvironmentSecrets } = require('./utils/secretValidator');
const PORT = config.port;

// Enterprise Security: Validate environment variable cryptographic strength
validateEnvironmentSecrets();

const pool = require('./config/db');
const fs = require('fs');
const path = require('path');
const readMig = (f) => fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
const sql = readMig('006_financial_approval_attachments.sql') + ';' + 
            readMig('007_extend_approvals_bulk.sql') + ';' + 
            readMig('008_approval_assignment.sql') + ';' + 
            readMig('009_sla_tracking.sql') + ';' + 
            readMig('010_approval_priority.sql') + ';' + 
            readMig('027_task_attachments.sql') + ';' +
            readMig('028_resource_allocations.sql');
pool.query(sql).then(() => console.log('Migrations OK')).catch(error => console.log(error));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startQueuePolling();
  startPdfWorker();
  startSlaTracking();
  startEmailQueue();
  startCronJobs();

  // Temporary DB debug dump
  const fs = require('fs');
  pool.query('SELECT id, name, email, phone FROM leads')
    .then(leadsRes => {
      return pool.query('SELECT * FROM lead_contacts').then(contactsRes => {
        fs.writeFileSync(
          path.join(__dirname, '../scratch/db_dump.json'),
          JSON.stringify({ leads: leadsRes.rows, contacts: contactsRes.rows }, null, 2)
        );
        console.log('--- DB DUMP WRITTEN SUCCESS ---');
      });
    })
    .catch(err => {
      fs.writeFileSync(
        path.join(__dirname, '../scratch/db_dump.json'),
        JSON.stringify({ error: err.message }, null, 2)
      );
      console.error('DB DUMP ERROR:', err);
    });
});
