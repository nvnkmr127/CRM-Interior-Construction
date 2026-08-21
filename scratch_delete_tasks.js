const pool = require('./server/src/config/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Try deleting comments, attachments, dependencies if they exist
    try {
      await client.query('DELETE FROM task_comments');
      console.log('Cleared task_comments');
    } catch (e) {
      console.log('Could not clear task_comments (might not exist or other error):', e.message);
    }

    try {
      await client.query('DELETE FROM task_attachments');
      console.log('Cleared task_attachments');
    } catch (e) {
      console.log('Could not clear task_attachments (might not exist or other error):', e.message);
    }

    try {
      await client.query('DELETE FROM task_dependencies');
      console.log('Cleared task_dependencies');
    } catch (e) {
      console.log('Could not clear task_dependencies (might not exist or other error):', e.message);
    }

    // Now delete from tasks
    const deleteRes = await client.query('DELETE FROM tasks');
    console.log(`Successfully deleted ${deleteRes.rowCount} tasks from database.`);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Transaction failed, rolled back:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
