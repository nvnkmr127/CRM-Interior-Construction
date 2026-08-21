const pool = require('../src/db/pool');
const { readPool } = pool;

async function run() {
  try {
    const visitId = '3a9c3e4a-6224-4757-97b0-cddd993315ae';
    
    // 1. Get current visit
    const visitRes = await readPool.query(`SELECT checklist FROM site_visits WHERE id = $1`, [visitId]);
    const currentChecklist = visitRes.rows[0].checklist || [];
    console.log("Current checklist in DB:", currentChecklist);

    // 2. Append new item
    const updatedChecklist = [...currentChecklist];
    updatedChecklist.push({ text: "Test Added Task " + Date.now(), completed: false });

    // 3. Patch via database query directly (simulating the PATCH backend query)
    const updateQuery = `
      UPDATE site_visits 
      SET checklist = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const updateRes = await readPool.query(updateQuery, [JSON.stringify(updatedChecklist), visitId]);
    console.log("Updated checklist in DB:", updateRes.rows[0].checklist);

  } catch (error) {
    console.error("Error during PATCH test:", error);
  } finally {
    await pool.end();
  }
}

run();
