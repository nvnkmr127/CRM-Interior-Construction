const pool = require('../../db/pool');
const { logAction } = require('../auditLog');

/**
 * Fetch retrospective, vendor ratings, and overall project vendors.
 */
async function getRetrospective(projectId, tenantId) {
  // Verify project exists
  const projRes = await pool.query(
    'SELECT id, name, status FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
    [projectId, tenantId]
  );
  if (projRes.rows.length === 0) {
    const err = new Error('PROJECT_NOT_FOUND');
    err.status = 404;
    throw err;
  }

  // Fetch retrospective
  const retroRes = await pool.query(
    'SELECT * FROM project_retrospectives WHERE project_id = $1 AND tenant_id = $2',
    [projectId, tenantId]
  );
  const retrospective = retroRes.rows[0] || null;

  // Fetch all vendors engaged in this project
  const vendorsRes = await pool.query(
    'SELECT id as project_vendor_id, vendor_name, scope_of_work, status FROM project_vendors WHERE project_id = $1 AND tenant_id = $2',
    [projectId, tenantId]
  );
  const projectVendors = vendorsRes.rows;

  let vendorRatings = [];
  if (retrospective) {
    // Fetch registered ratings
    const ratingsRes = await pool.query(
      `SELECT prv.*, pv.vendor_name, pv.scope_of_work 
       FROM project_retrospective_vendors prv
       JOIN project_vendors pv ON prv.project_vendor_id = pv.id
       WHERE prv.retrospective_id = $1 AND prv.tenant_id = $2`,
      [retrospective.id, tenantId]
    );
    vendorRatings = ratingsRes.rows;
  }

  // Combine project vendors with their ratings (if any)
  const combinedRatings = projectVendors.map(pv => {
    const ratingObj = vendorRatings.find(r => r.project_vendor_id === pv.project_vendor_id);
    return {
      project_vendor_id: pv.project_vendor_id,
      vendor_name: pv.vendor_name,
      scope_of_work: pv.scope_of_work,
      rating: ratingObj ? ratingObj.rating : null,
      feedback: ratingObj ? ratingObj.feedback : ''
    };
  });

  return {
    retrospective,
    vendorRatings: combinedRatings,
    projectVendors
  };
}

/**
 * Create or update the project retrospective and its vendor performance ratings in a SQL transaction.
 */
async function saveRetrospective(projectId, tenantId, userId, data) {
  const { what_went_well, what_went_wrong, design_feedback, process_changes, vendor_ratings = [] } = data;

  // Verify project exists
  const projRes = await pool.query(
    'SELECT id FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
    [projectId, tenantId]
  );
  if (projRes.rows.length === 0) {
    const err = new Error('PROJECT_NOT_FOUND');
    err.status = 404;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Upsert retrospective
    const retroQuery = `
      INSERT INTO project_retrospectives (
        tenant_id, project_id, what_went_well, what_went_wrong, 
        design_feedback, process_changes, created_by, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT (project_id) DO UPDATE SET
        what_went_well = EXCLUDED.what_went_well,
        what_went_wrong = EXCLUDED.what_went_wrong,
        design_feedback = EXCLUDED.design_feedback,
        process_changes = EXCLUDED.process_changes,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const retroValues = [
      tenantId, projectId, what_went_well || null, what_went_wrong || null,
      design_feedback || null, process_changes || null, userId
    ];

    const retroRes = await client.query(retroQuery, retroValues);
    const retrospective = retroRes.rows[0];

    // 2. Upsert vendor ratings
    if (Array.isArray(vendor_ratings) && vendor_ratings.length > 0) {
      for (const item of vendor_ratings) {
        const { project_vendor_id, rating, feedback } = item;
        
        // Skip if invalid rating or missing vendor reference
        if (!project_vendor_id || rating === undefined || rating === null) continue;

        const ratingVal = parseInt(rating, 10);
        if (isNaN(ratingVal) || ratingVal < 1 || ratingVal > 5) {
          throw new Error('INVALID_RATING');
        }

        const ratingQuery = `
          INSERT INTO project_retrospective_vendors (
            tenant_id, retrospective_id, project_vendor_id, rating, feedback, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
          ON CONFLICT (retrospective_id, project_vendor_id) DO UPDATE SET
            rating = EXCLUDED.rating,
            feedback = EXCLUDED.feedback,
            updated_at = CURRENT_TIMESTAMP
        `;
        const ratingValues = [
          tenantId, retrospective.id, project_vendor_id, ratingVal, feedback || null
        ];
        
        await client.query(ratingQuery, ratingValues);
      }
    }

    // 3. Log audit action
    await logAction({
      tenantId,
      userId,
      action: 'project.retrospective_saved',
      entity: 'project',
      entityId: projectId,
      newValue: { retrospectiveId: retrospective.id }
    }, client);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Fetch final updated structure to return
  return getRetrospective(projectId, tenantId);
}

module.exports = {
  getRetrospective,
  saveRetrospective
};
