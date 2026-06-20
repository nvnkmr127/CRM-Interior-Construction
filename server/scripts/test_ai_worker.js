const eventBus = require('../src/services/eventBus');
require('../src/services/ai/aiEventHandler');
require('../src/queues/workers/aiWorker');
const { connection } = require('../src/queues/queueSetup');

async function run() {
  console.log('Triggering fake stage change event...');
  
  // We need a real tenantId and leadId for the worker to find the lead in DB.
  // We'll just emit it, and if it fails to find the lead, it will log "Lead undefined not found"
  // which still proves the event bus -> queue -> worker pipeline works.
  
  eventBus.publish('lead.stage_changed', {
    id: '12345678-1234-1234-1234-123456789012'
  }, { tenantId: '12345678-1234-1234-1234-123456789012' });

  // Wait a bit for the worker to pick it up from Redis
  setTimeout(() => {
    console.log('Finished waiting. Exiting...');
    process.exit(0);
  }, 3000);
}

run();
