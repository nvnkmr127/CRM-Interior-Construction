const pool = require('../config/db');

class MilestoneRepository {
  async findMilestonesByPhase(phaseId, tenantId) {
    const { rows } = await pool.query(`
      SELECT * FROM milestones
      WHERE phase_id = $1 AND tenant_id = $2
      ORDER BY sort_order ASC, created_at ASC
    `, [phaseId, tenantId]);
    return rows;
  }

  async createMilestone(tenantId, phaseId, projectId, data) {
    const {
      name, description, due_date, status = 'pending',
      triggers_payment = false, sort_order = 0
    } = data;

    const query = `
      INSERT INTO milestones (
        tenant_id, phase_id, project_id, name, description,
        due_date, status, triggers_payment, sort_order
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) RETURNING *
    `;
    const values = [
      tenantId, phaseId, projectId, name, description || null,
      due_date || null, status, triggers_payment, sort_order
    ];

    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  async updateMilestone(milestoneId, tenantId, updates) {
    if (updates.status === 'pending') {
      updates.completion_date = null;
      updates.completed_by = null;
      try {
        const msRes = await pool.query('SELECT project_id, name, triggers_payment FROM milestones WHERE id = $1 AND tenant_id = $2', [milestoneId, tenantId]);
        if (msRes.rows.length > 0 && msRes.rows[0].triggers_payment) {
          await pool.query(`
            UPDATE payment_milestones
            SET status = 'scheduled'
            WHERE tenant_id = $2
              AND status = 'invoice_raised'
              AND (
                milestone_id = $1
                OR (project_id = $3 AND (LOWER(TRIM(name)) = LOWER(TRIM($4)) OR LOWER(name) LIKE '%' || LOWER(TRIM($4)) || '%'))
              )
          `, [milestoneId, tenantId, msRes.rows[0].project_id, msRes.rows[0].name]);
        }
      } catch (err) {
        console.error('[MilestoneRepo] Error rolling back payment status on uncheck:', err);
      }
    }

    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (['id', 'tenant_id', 'phase_id', 'project_id', 'created_at'].includes(key)) continue;
      fields.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }

    if (fields.length === 0) {
      const { rows } = await pool.query(`SELECT * FROM milestones WHERE id = $1 AND tenant_id = $2`, [milestoneId, tenantId]);
      return rows[0];
    }

    values.push(milestoneId, tenantId);
    const query = `
      UPDATE milestones
      SET ${fields.join(', ')}
      WHERE id = $${idx} AND tenant_id = $${idx + 1}
      RETURNING *
    `;

    const { rows } = await pool.query(query, values);
    if (rows.length === 0) throw new Error('NOT_FOUND');
    const milestone = rows[0];

    // Sync linked payment milestone name and due date if changed
    if (milestone && (updates.name || updates.due_date !== undefined)) {
      const pmFields = [];
      const pmValues = [];
      let pIdx = 1;
      if (updates.name) {
        pmFields.push(`name = $${pIdx++}`);
        pmValues.push(updates.name);
      }
      if (updates.due_date !== undefined) {
        pmFields.push(`due_date = $${pIdx++}`);
        pmValues.push(updates.due_date);
      }
      if (pmFields.length > 0) {
        pmValues.push(milestoneId, tenantId);
        await pool.query(
          `UPDATE payment_milestones SET ${pmFields.join(', ')} WHERE milestone_id = $${pIdx++} AND tenant_id = $${pIdx}`,
          pmValues
        ).catch(() => {});
      }
    }

    // Auto-sync phase status on milestone update
    if (milestone && milestone.phase_id) {
      // Sync linked tasks in tasks table if status changed
      if (updates.status) {
        if (updates.status === 'completed' || updates.status === 'done') {
          await pool.query(`
            UPDATE tasks
            SET status = 'done', updated_at = NOW()
            WHERE tenant_id = $2
              AND status != 'done'
              AND deleted_at IS NULL
              AND (
                milestone_id = $1 
                OR (project_id = $3 AND (LOWER(TRIM(title)) = LOWER(TRIM($4)) OR LOWER(title) LIKE '%' || LOWER(TRIM($4)) || '%'))
              )
          `, [milestoneId, tenantId, milestone.project_id, milestone.name]).catch(err => {
            logger.error('[MilestoneRepository] Task sync error on update complete:', err);
          });
        } else {
          await pool.query(`
            UPDATE tasks
            SET status = 'todo', updated_at = NOW()
            WHERE tenant_id = $2
              AND status = 'done'
              AND deleted_at IS NULL
              AND (
                milestone_id = $1 
                OR (project_id = $3 AND (LOWER(TRIM(title)) = LOWER(TRIM($4)) OR LOWER(title) LIKE '%' || LOWER(TRIM($4)) || '%'))
              )
          `, [milestoneId, tenantId, milestone.project_id, milestone.name]).catch(err => {
            logger.error('[MilestoneRepository] Task sync error on revert:', err);
          });
        }
      }

      const stats = await pool.query(`
        SELECT 
          COUNT(*)::int as total_milestones,
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed_milestones
        FROM milestones
        WHERE phase_id = $1 AND tenant_id = $2
      `, [milestone.phase_id, tenantId]);

      if (stats.rows.length > 0) {
        const { total_milestones, completed_milestones } = stats.rows[0];
        if (total_milestones > 0 && completed_milestones === total_milestones) {
          const updatedPhaseRes = await pool.query(`
            UPDATE project_phases
            SET status = 'completed'
            WHERE id = $1 AND tenant_id = $2
            RETURNING sort_order, project_id
          `, [milestone.phase_id, tenantId]);

          if (updatedPhaseRes.rows.length > 0) {
            const currentOrder = updatedPhaseRes.rows[0].sort_order;
            const projId = updatedPhaseRes.rows[0].project_id;
            const nextPhaseRes = await pool.query(`
              SELECT id FROM project_phases
              WHERE project_id = $1 AND tenant_id = $2 AND sort_order > $3
              ORDER BY sort_order ASC
              LIMIT 1
            `, [projId, tenantId, currentOrder]);

            if (nextPhaseRes.rows.length > 0) {
              await pool.query(`
                UPDATE project_phases
                SET status = 'in_progress'
                WHERE id = $1 AND tenant_id = $2 AND status = 'pending'
              `, [nextPhaseRes.rows[0].id, tenantId]);
            }
          }
        } else if (completed_milestones < total_milestones) {
          // Revert phase to in_progress if it was previously completed
          const revertedPhases = await pool.query(`
            UPDATE project_phases
            SET status = 'in_progress'
            WHERE id = $1 AND tenant_id = $2 AND status = 'completed'
            RETURNING sort_order, project_id
          `, [milestone.phase_id, tenantId]);

          if (revertedPhases.rows.length > 0) {
            const currentOrder = revertedPhases.rows[0].sort_order;
            const projId = revertedPhases.rows[0].project_id;
            // Any subsequent phase that was auto-advanced to in_progress with 0 completed milestones reverts to pending
            await pool.query(`
              UPDATE project_phases pp
              SET status = 'pending'
              WHERE pp.project_id = $1 AND pp.tenant_id = $2 AND pp.sort_order > $3
                AND pp.status = 'in_progress'
                AND NOT EXISTS (
                  SELECT 1 FROM milestones m WHERE m.phase_id = pp.id AND m.status = 'completed'
                )
                AND NOT EXISTS (
                  SELECT 1 FROM project_work_activities pwa WHERE pwa.phase_id = pp.id AND pwa.status = 'completed'
                )
            `, [projId, tenantId, currentOrder]);
          }
        }
      }
    }

    const { clearCachePrefix } = require('../utils/cache');
    await clearCachePrefix('cache:').catch(() => {});
    await clearCachePrefix('/api/projects').catch(() => {});
    await clearCachePrefix('/api/tasks').catch(() => {});
    if (milestone?.project_id) {
      await clearCachePrefix(milestone.project_id).catch(() => {});
    }

    return milestone;
  }

  async completeMilestone(milestoneId, userId, tenantId) {
    // 1. Mark milestone as completed
    const query = `
      UPDATE milestones
      SET status = 'completed', completion_date = CURRENT_DATE, completed_by = $1
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
    `;
    const { rows } = await pool.query(query, [userId, milestoneId, tenantId]);
    if (rows.length === 0) throw new Error('NOT_FOUND');
    
    const milestone = rows[0];

    // 1b. Mark linked tasks as done in tasks table
    await pool.query(`
      UPDATE tasks
      SET status = 'done', updated_at = NOW()
      WHERE tenant_id = $2
        AND status != 'done'
        AND deleted_at IS NULL
        AND (
          milestone_id = $1 
          OR (project_id = $3 AND (LOWER(TRIM(title)) = LOWER(TRIM($4)) OR LOWER(title) LIKE '%' || LOWER(TRIM($4)) || '%'))
        )
    `, [milestoneId, tenantId, milestone.project_id, milestone.name]).catch(err => {
      logger.error('[MilestoneRepository] Task sync error on complete:', err);
    });

    // 2. Trigger payment cascade if enabled
    if (milestone.triggers_payment) {
      await pool.query(`
        UPDATE payment_milestones
        SET status = 'invoice_raised'
        WHERE tenant_id = $2 
          AND status = 'scheduled'
          AND (
            milestone_id = $1 
            OR (project_id = $3 AND (LOWER(TRIM(name)) = LOWER(TRIM($4)) OR LOWER(name) LIKE '%' || LOWER(TRIM($4)) || '%'))
          )
      `, [milestoneId, tenantId, milestone.project_id, milestone.name]);
    }

    // 3. Auto-sync phase status
    if (milestone.phase_id) {
      const stats = await pool.query(`
        SELECT 
          COUNT(*)::int as total_milestones,
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed_milestones
        FROM milestones
        WHERE phase_id = $1 AND tenant_id = $2
      `, [milestone.phase_id, tenantId]);

      if (stats.rows.length > 0) {
        const { total_milestones, completed_milestones } = stats.rows[0];
        if (total_milestones > 0 && completed_milestones === total_milestones) {
          const updatedPhaseRes = await pool.query(`
            UPDATE project_phases
            SET status = 'completed'
            WHERE id = $1 AND tenant_id = $2
            RETURNING sort_order, project_id
          `, [milestone.phase_id, tenantId]);

          if (updatedPhaseRes.rows.length > 0) {
            const currentOrder = updatedPhaseRes.rows[0].sort_order;
            const projId = updatedPhaseRes.rows[0].project_id;
            const nextPhaseRes = await pool.query(`
              SELECT id FROM project_phases
              WHERE project_id = $1 AND tenant_id = $2 AND sort_order > $3
              ORDER BY sort_order ASC
              LIMIT 1
            `, [projId, tenantId, currentOrder]);

            if (nextPhaseRes.rows.length > 0) {
              await pool.query(`
                UPDATE project_phases
                SET status = 'in_progress'
                WHERE id = $1 AND tenant_id = $2 AND status = 'pending'
              `, [nextPhaseRes.rows[0].id, tenantId]);
            }
          }
        } else if (completed_milestones > 0) {
          // If some milestones are done, ensure phase is in_progress if pending
          await pool.query(`
            UPDATE project_phases
            SET status = 'in_progress'
            WHERE id = $1 AND tenant_id = $2 AND status = 'pending'
          `, [milestone.phase_id, tenantId]);
        }
      }
    }

    const { clearCachePrefix } = require('../utils/cache');
    await clearCachePrefix('cache:').catch(() => {});
    await clearCachePrefix('/api/projects').catch(() => {});
    await clearCachePrefix('/api/tasks').catch(() => {});
    if (milestone.project_id) {
      await clearCachePrefix(milestone.project_id).catch(() => {});
    }

    return milestone;
  }
}

module.exports = new MilestoneRepository();
