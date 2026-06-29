const pool = require('../config/db');

class BaselineAssessmentRepository {
  async findAssessment(tenantId, projectId, dbClient = pool) {
    const assessmentQuery = `
      SELECT pba.*, u.name as assessed_by_name 
      FROM project_baseline_assessments pba
      LEFT JOIN users u ON pba.assessed_by = u.id
      WHERE pba.project_id = $1 AND pba.tenant_id = $2
    `;
    const { rows } = await dbClient.query(assessmentQuery, [projectId, tenantId]);
    if (rows.length === 0) return null;

    const assessment = rows[0];
    const itemsQuery = `
      SELECT * FROM project_baseline_items
      WHERE assessment_id = $1 AND tenant_id = $2
      ORDER BY room_name, area_checked
    `;
    const itemsRes = await dbClient.query(itemsQuery, [assessment.id, tenantId]);
    assessment.items = itemsRes.rows;
    return assessment;
  }

  async saveAssessment(tenantId, projectId, assessedBy, data, dbClient = pool) {
    const { overall_notes, video_walkthrough_url, items = [] } = data;
    
    // We run this inside a transaction if we use the default pool client
    const isDedicatedClient = dbClient !== pool;
    const client = isDedicatedClient ? dbClient : await pool.connect();

    try {
      if (!isDedicatedClient) {
        await client.query('BEGIN');
      }

      // 1. Upsert assessment header
      const upsertQuery = `
        INSERT INTO project_baseline_assessments (
          tenant_id, project_id, assessed_by, overall_notes, video_walkthrough_url
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (project_id) DO UPDATE SET
          overall_notes = EXCLUDED.overall_notes,
          video_walkthrough_url = EXCLUDED.video_walkthrough_url,
          assessed_by = EXCLUDED.assessed_by,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      const assessmentRes = await client.query(upsertQuery, [
        tenantId, projectId, assessedBy, overall_notes, video_walkthrough_url
      ]);
      const assessment = assessmentRes.rows[0];

      // 2. Clear existing items
      await client.query(
        'DELETE FROM project_baseline_items WHERE assessment_id = $1 AND tenant_id = $2',
        [assessment.id, tenantId]
      );

      // 3. Insert new items
      const savedItems = [];
      if (items.length > 0) {
        for (const item of items) {
          const itemQuery = `
            INSERT INTO project_baseline_items (
              tenant_id, assessment_id, room_name, area_checked, condition_status, notes, photos
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
          `;
          const itemRes = await client.query(itemQuery, [
            tenantId,
            assessment.id,
            item.room_name,
            item.area_checked,
            item.condition_status || 'ok',
            item.notes || null,
            JSON.stringify(item.photos || [])
          ]);
          savedItems.push(itemRes.rows[0]);
        }
      }

      if (!isDedicatedClient) {
        await client.query('COMMIT');
      }

      assessment.items = savedItems;
      return assessment;
    } catch (err) {
      if (!isDedicatedClient) {
        await client.query('ROLLBACK');
      }
      throw err;
    } finally {
      if (!isDedicatedClient) {
        client.release();
      }
    }
  }
}

module.exports = new BaselineAssessmentRepository();
