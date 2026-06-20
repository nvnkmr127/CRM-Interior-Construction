const { Worker } = require('bullmq');
const { connection } = require('../../utils/redis');
const readPool = require('../../db/pool').readPool || require('../../db/pool');
const fs = require('fs');
const path = require('path');
// const { uploadToS3 } = require('../../utils/storage'); // For real cloud deployment

const workerName = 'DataWarehouseExport';

const dataWarehouseWorker = new Worker(workerName, async job => {
  const { tenantId, exportType, date } = job.data;
  console.log(`[${workerName}] Starting export for tenant ${tenantId}, type: ${exportType}`);

  try {
    let query = '';
    
    if (exportType === 'leads_daily_delta') {
      // Export leads created or updated on the specific date
      query = `
        SELECT * FROM leads
        WHERE tenant_id = $1
        AND DATE(updated_at) = $2
      `;
    } else if (exportType === 'full_snapshot') {
      query = `
        SELECT * FROM leads
        WHERE tenant_id = $1
      `;
    }

    if (!query) {
      throw new Error(`Unsupported export type: ${exportType}`);
    }

    const { rows } = await readPool.query(query, [tenantId, date]);
    
    // In an enterprise app, we stream this directly to Object Storage
    // For local implementation, we simulate by writing to local disk
    const exportPath = path.resolve(__dirname, `../../../storage/dw_export_${tenantId}_${exportType}_${date}.json`);
    
    fs.writeFileSync(exportPath, JSON.stringify(rows, null, 2));

    // await uploadToS3(exportPath, `dw-ingestion/${tenantId}/${date}.json`);

    console.log(`[${workerName}] Successfully exported ${rows.length} rows to ${exportPath}`);
    return { success: true, count: rows.length, path: exportPath };
  } catch (error) {
    console.error(`[${workerName}] Export failed:`, error.message);
    throw error;
  }
}, { connection });

dataWarehouseWorker.on('completed', (job) => {
  console.log(`[${workerName}] Job ${job.id} completed!`);
});

dataWarehouseWorker.on('failed', (job, err) => {
  console.error(`[${workerName}] Job ${job.id} failed with error ${err.message}`);
});

module.exports = dataWarehouseWorker;
