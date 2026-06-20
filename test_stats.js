const pool = require('./server/src/db/pool');
const analyticsService = require('./server/src/services/analytics/analyticsService');

async function test() {
  const tenantId = '33fb1b95-5b1d-441d-b25a-694ea3e1f7e0';
  const userId = '73c6c8ec-6a62-486a-9cce-844e145bbf8c';
  
  try {
    const data = await analyticsService.getGlobalStats(tenantId, userId);
    console.log("SUCCESS:", Object.keys(data));
  } catch (e) {
    console.error("FAIL getGlobalStats:", e.stack);
  }

  process.exit(0);
}
test();
