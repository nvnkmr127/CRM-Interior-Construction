const { Worker } = require('bullmq');
const { connection } = require('../queueSetup');
const pool = require('../../db/pool');

const archiveWorker = new Worker('Archive_Queue', async job => {
  const { tenantId, daysOld = 365 } = job.data;
  console.log(`[ArchiveWorker] Archiving leads closed > ${daysOld} days for tenant ${tenantId}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Move old won/lost leads to an archive table (assuming leads_archive schema matches leads)
    // For local implementation, we just soft-delete them or tag them as archived.
    // In an enterprise system, this would insert into a partition or cold storage schema.
    const archiveQuery = `
      UPDATE leads l
      SET status = 'archived', updated_at = NOW()
      FROM lead_stages ls
      WHERE l.stage_id = ls.id 
        AND l.tenant_id = $1 
        AND l.status = 'active'
        AND l.updated_at < NOW() - INTERVAL '${daysOld} days'
        AND (ls.is_won = true OR ls.is_lost = true)
      RETURNING l.id;
    `;
    
    const { rows } = await client.query(archiveQuery, [tenantId]);
    
    await client.query('COMMIT');
    console.log(`[ArchiveWorker] Archived ${rows.length} leads for tenant ${tenantId}`);
    return { success: true, archivedCount: rows.length };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[ArchiveWorker] Archive failed:`, error.message);
    throw error;
  } finally {
    client.release();
  }
}, { connection });

module.exports = archiveWorker;
