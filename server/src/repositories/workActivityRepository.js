const pool = require('../config/db');

const DEFAULT_QC_CHECKLISTS = {
  carpentry: [
    { label: 'Verify dimensions match approved design drawing', required: true },
    { label: 'Check veneer/laminate grains alignment and color matching', required: true },
    { label: 'Check drawer runners and soft-close hinges function smoothly', required: true },
    { label: 'Ensure edge banding is smooth and free of sharp edges', required: true },
    { label: 'Verify handle alignment and installation height', required: true }
  ],
  painting: [
    { label: 'Check wall surface is sanded smooth and clean of dust', required: true },
    { label: 'Verify application of wall primer coat', required: true },
    { label: 'Ensure putty levels are checked under light to find imperfections', required: true },
    { label: 'Check final paint coat color uniformity and edge alignments', required: true },
    { label: 'Ensure no paint stains on flooring, switch plates, or windows', required: true }
  ],
  electrical: [
    { label: 'Verify conduit pipe layout matches layout drawing', required: true },
    { label: 'Check continuity and insulation resistance test of cables', required: true },
    { label: 'Ensure correct rating of MCBs and correct labeling in DB', required: true },
    { label: 'Verify all modular switch plates are level and securely fixed', required: true },
    { label: 'Test all light points, sockets, and appliance outlets', required: true }
  ],
  plumbing: [
    { label: 'Pressure test water supply pipes for 24 hours at 10 bar', required: true },
    { label: 'Check drainage slope/alignment to ensure no water stagnation', required: true },
    { label: 'Conduct waterproofing pond test in bathroom for 48 hours', required: true },
    { label: 'Verify fitment of WCs and washbasin without wobble', required: true },
    { label: 'Check all CP fittings (faucets, showers) for leakage and flow rate', required: true }
  ],
  flooring: [
    { label: 'Verify subfloor cleaning and level markings before laying tiles/marble', required: true },
    { label: 'Check tile spacers are used and joint lines are perfectly aligned', required: true },
    { label: 'Verify hollow-sound check by tapping laid tiles/stones', required: true },
    { label: 'Check slope towards drain point in dry/wet areas', required: true },
    { label: 'Ensure grout filling is complete and uniform', required: true }
  ],
  civil: [
    { label: 'Check brickwork alignment and verticality', required: true },
    { label: 'Verify concrete/mortar mix ratio', required: true }
  ],
  false_ceiling: [
    { label: 'Check level of ceiling frame grid', required: true },
    { label: 'Verify spacing of hangers/anchors', required: true }
  ],
  glass: [
    { label: 'Check glass thickness and specifications', required: true },
    { label: 'Verify glass alignment and silicone sealing', required: true }
  ],
  soft_furnishing: [
    { label: 'Verify curtain tracks are securely anchored', required: true },
    { label: 'Check wallpaper seams and glue stains', required: true }
  ]
};

async function resolveQcChecklist(tenantId, trade, customQcList = null) {
  if (customQcList && Array.isArray(customQcList)) {
    return customQcList;
  }
  
  try {
    const result = await pool.query('SELECT config FROM tenants WHERE id = $1', [tenantId]);
    if (result.rows.length > 0) {
      const configStr = result.rows[0].config;
      const config = typeof configStr === 'string' ? JSON.parse(configStr || '{}') : (configStr || {});
      const tenantQcList = config.qc_checklists?.[trade];
      if (Array.isArray(tenantQcList) && tenantQcList.length > 0) {
        return tenantQcList.map((item, index) => ({
          id: item.id || `qc_${trade}_${index}_${Date.now()}`,
          label: item.label,
          required: item.required !== false,
          is_checked: false
        }));
      }
    }
  } catch (err) {
    console.error('[resolveQcChecklist] Error reading tenant settings:', err);
  }

  const defaultList = DEFAULT_QC_CHECKLISTS[trade] || [];
  return defaultList.map((item, index) => ({
    id: `qc_${trade}_${index}_${Date.now()}`,
    label: item.label,
    required: item.required !== false,
    is_checked: false
  }));
}


class WorkActivityRepository {
  async findActivities(tenantId, projectId, filters = {}) {
    const { phaseId, trade, roomName, status } = filters;
    const values = [tenantId, projectId];
    let whereClause = `pwa.tenant_id = $1 AND pwa.project_id = $2`;
    let idx = 3;

    if (phaseId) {
      whereClause += ` AND pwa.phase_id = $${idx++}`;
      values.push(phaseId);
    }
    if (trade) {
      whereClause += ` AND pwa.trade = $${idx++}`;
      values.push(trade);
    }
    if (roomName) {
      whereClause += ` AND pwa.room_name = $${idx++}`;
      values.push(roomName);
    }
    if (status) {
      whereClause += ` AND pwa.status = $${idx}`;
      values.push(status);
    }

    const query = `
      SELECT pwa.*,
        u.name as assignee_name,
        cb.name as completed_by_name
      FROM project_work_activities pwa
      LEFT JOIN users u ON pwa.assignee_id = u.id
      LEFT JOIN users cb ON pwa.completed_by = cb.id
      WHERE ${whereClause}
      ORDER BY pwa.created_at ASC
    `;
    const { rows } = await pool.query(query, values);
    
    // Attach photos and dependencies
    const storage = require('../utils/storage');
    for (const activity of rows) {
      const { rows: photos } = await pool.query(`
        SELECT wap.*, u.name as uploader_name
        FROM work_activity_photos wap
        LEFT JOIN users u ON wap.uploaded_by = u.id
        WHERE wap.activity_id = $1 AND wap.tenant_id = $2
        ORDER BY wap.created_at ASC
      `, [activity.id, tenantId]);
      
      for (const p of photos) {
        p.url = await storage.getDownloadUrl(p.file_url);
      }
      activity.photos = photos;

      const { rows: dependencies } = await pool.query(`
        SELECT wad.*, pwa.activity_name as depends_on_activity_name, pwa.status as depends_on_activity_status
        FROM work_activity_dependencies wad
        JOIN project_work_activities pwa ON wad.depends_on_activity_id = pwa.id
        WHERE wad.activity_id = $1 AND wad.tenant_id = $2
      `, [activity.id, tenantId]);
      activity.dependencies = dependencies;
    }
    
    return rows;
  }

  async findActivityById(id, tenantId) {
    const query = `
      SELECT pwa.*,
        u.name as assignee_name,
        cb.name as completed_by_name
      FROM project_work_activities pwa
      LEFT JOIN users u ON pwa.assignee_id = u.id
      LEFT JOIN users cb ON pwa.completed_by = cb.id
      WHERE pwa.id = $1 AND pwa.tenant_id = $2
    `;
    const { rows } = await pool.query(query, [id, tenantId]);
    const activity = rows[0] || null;
    if (activity) {
      // Attach photos
      const storage = require('../utils/storage');
      const { rows: photos } = await pool.query(`
        SELECT wap.*, u.name as uploader_name
        FROM work_activity_photos wap
        LEFT JOIN users u ON wap.uploaded_by = u.id
        WHERE wap.activity_id = $1 AND wap.tenant_id = $2
        ORDER BY wap.created_at ASC
      `, [id, tenantId]);
      
      for (const p of photos) {
        p.url = await storage.getDownloadUrl(p.file_url);
      }
      activity.photos = photos;

      // Attach dependencies
      const { rows: dependencies } = await pool.query(`
        SELECT wad.*, pwa.activity_name as depends_on_activity_name, pwa.status as depends_on_activity_status
        FROM work_activity_dependencies wad
        JOIN project_work_activities pwa ON wad.depends_on_activity_id = pwa.id
        WHERE wad.activity_id = $1 AND wad.tenant_id = $2
      `, [id, tenantId]);
      activity.dependencies = dependencies;
    }
    return activity;
  }

  async createActivity(tenantId, data) {
    const {
      project_id, phase_id, room_name, trade, activity_name,
      description, assignee_id, due_date, status = 'todo', notes, qc_checklist
    } = data;

    const resolvedChecklist = await resolveQcChecklist(tenantId, trade, qc_checklist);

    const query = `
      INSERT INTO project_work_activities (
        tenant_id, project_id, phase_id, room_name, trade, activity_name,
        description, assignee_id, due_date, status, notes, qc_checklist
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      ) RETURNING *
    `;
    const values = [
      tenantId, project_id, phase_id || null, room_name, trade, activity_name,
      description || null, assignee_id || null, due_date || null, status, notes || null,
      JSON.stringify(resolvedChecklist)
    ];

    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  async updateActivity(id, tenantId, updates, userId = null) {
    const fields = [];
    const values = [];
    let idx = 1;

    // Auto-update completed_at / completed_by when status changes to completed
    if (updates.status) {
      const currentActivity = await this.findActivityById(id, tenantId);
      if (!currentActivity) throw new Error('NOT_FOUND');

      // Check dependencies if status is in_progress or completed
      if (updates.status === 'in_progress' || updates.status === 'completed') {
        // Read tenant config for dependency enforcement mode ('hard', 'soft', 'none')
        const { rows: tenantRows } = await pool.query(
          'SELECT config FROM tenants WHERE id = $1',
          [tenantId]
        );
        const configStr = tenantRows[0]?.config;
        const tenantConfig = typeof configStr === 'string' ? JSON.parse(configStr || '{}') : (configStr || {});
        const enforcementMode = tenantConfig.dependency_enforcement_mode || 'hard';

        if (enforcementMode !== 'none') {
          const { rows: deps } = await pool.query(`
            SELECT wad.*, pwa.activity_name as depends_on_name, pwa.status as depends_on_status
            FROM work_activity_dependencies wad
            JOIN project_work_activities pwa ON wad.depends_on_activity_id = pwa.id
            WHERE wad.activity_id = $1 AND wad.tenant_id = $2
          `, [id, tenantId]);

          for (const dep of deps) {
            if (dep.depends_on_status !== 'completed') {
              if (enforcementMode === 'soft' && !updates.force) {
                const err = new Error('DEPENDENCY_UNSATISFIED_SOFT');
                err.status = 400;
                err.code = 'DEPENDENCY_UNSATISFIED_SOFT';
                err.message = `Prerequisite activity '${dep.depends_on_name}' is not completed. Do you want to proceed anyway?`;
                throw err;
              } else if (enforcementMode === 'hard') {
                const err = new Error('DEPENDENCY_UNSATISFIED');
                err.status = 400;
                err.code = 'DEPENDENCY_UNSATISFIED';
                err.message = `Cannot start/complete work activity: Prerequisite activity '${dep.depends_on_name}' must be completed first.`;
                throw err;
              }
            }
          }
        }
      }

      if (updates.status === 'completed') {
        const qcChecklist = updates.qc_checklist !== undefined ? updates.qc_checklist : currentActivity.qc_checklist;
        const parsedChecklist = typeof qcChecklist === 'string' ? JSON.parse(qcChecklist) : (qcChecklist || []);

        const incomplete = parsedChecklist.filter(item => item.required && !item.is_checked);
        if (incomplete.length > 0) {
          const error = new Error('QC_CHECKLIST_INCOMPLETE');
          error.status = 400;
          error.code = 'QC_CHECKLIST_INCOMPLETE';
          error.message = `Cannot complete work activity: There are ${incomplete.length} unchecked required QC checklist items.`;
          throw error;
        }

        updates.completed_at = new Date().toISOString();
        if (userId) {
          updates.completed_by = userId;
        }
      } else {
        updates.completed_at = null;
        updates.completed_by = null;
      }
    }

    updates.updated_at = new Date().toISOString();

    for (const [key, value] of Object.entries(updates)) {
      if (['id', 'project_id', 'tenant_id', 'created_at', 'completed_by_name', 'assignee_name', 'force'].includes(key)) continue;
      fields.push(`${key} = $${idx}`);
      if (key === 'qc_checklist') {
        values.push(JSON.stringify(value));
      } else {
        values.push(value);
      }
      idx++;
    }

    if (fields.length === 0) {
      return this.findActivityById(id, tenantId);
    }

    values.push(id, tenantId);
    const query = `
      UPDATE project_work_activities
      SET ${fields.join(', ')}
      WHERE id = $${idx} AND tenant_id = $${idx + 1}
      RETURNING *
    `;

    const { rows } = await pool.query(query, values);
    if (rows.length === 0) throw new Error('NOT_FOUND');
    return rows[0];
  }

  async deleteActivity(id, tenantId) {
    const { rowCount } = await pool.query(`
      DELETE FROM project_work_activities
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);

    if (rowCount === 0) throw new Error('NOT_FOUND');
    return true;
  }

  async findTemplates(trade = null, roomType = null, tenantId = null) {
    let query = `SELECT * FROM trade_activity_templates`;
    const values = [];
    let whereClauses = [];

    if (tenantId) {
      whereClauses.push(`(tenant_id = $${values.length + 1} OR tenant_id IS NULL)`);
      values.push(tenantId);
    }

    if (trade) {
      whereClauses.push(`trade = $${values.length + 1}`);
      values.push(trade);
    }
    if (roomType) {
      whereClauses.push(`(room_type = $${values.length + 1} OR room_type = 'General')`);
      values.push(roomType);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ` + whereClauses.join(' AND ');
    }

    query += ` ORDER BY trade ASC, sort_order ASC`;
    const { rows } = await pool.query(query, values);
    return rows;
  }

  async createTemplate(tenantId, data) {
    const { trade, room_type = 'General', activity_name, description, sort_order = 0 } = data;
    const query = `
      INSERT INTO trade_activity_templates (tenant_id, trade, room_type, activity_name, description, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [tenantId, trade, room_type, activity_name, description || null, sort_order]);
    return rows[0];
  }

  async updateTemplate(id, tenantId, updates) {
    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (['id', 'tenant_id', 'created_at'].includes(key)) continue;
      fields.push(`${key} = $${idx++}`);
      values.push(value);
    }

    if (fields.length === 0) {
      const { rows } = await pool.query('SELECT * FROM trade_activity_templates WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)', [id, tenantId]);
      return rows[0] || null;
    }

    values.push(id, tenantId);
    const query = `
      UPDATE trade_activity_templates
      SET ${fields.join(', ')}
      WHERE id = $${idx} AND tenant_id = $${idx + 1}
      RETURNING *
    `;
    const { rows } = await pool.query(query, values);
    if (rows.length === 0) throw new Error('NOT_FOUND');
    return rows[0];
  }

  async deleteTemplate(id, tenantId) {
    const { rowCount } = await pool.query(`
      DELETE FROM trade_activity_templates
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    if (rowCount === 0) throw new Error('NOT_FOUND');
    return true;
  }

  async generateActivities(tenantId, projectId, phaseId, roomName, trade) {
    // 1. Resolve roomType based on roomName
    let roomType = 'General';
    const lowerName = roomName.toLowerCase();
    if (lowerName.includes('kitchen')) {
      roomType = 'Kitchen';
    } else if (lowerName.includes('bedroom')) {
      roomType = 'Bedroom';
    } else if (lowerName.includes('bathroom') || lowerName.includes('toilet') || lowerName.includes('restroom') || lowerName.includes('washroom')) {
      roomType = 'Bathroom';
    } else if (lowerName.includes('living') || lowerName.includes('hall') || lowerName.includes('drawing')) {
      roomType = 'Living Room';
    }

    // 2. Fetch templates for this trade, roomType, and tenantId
    const templates = await this.findTemplates(trade, roomType, tenantId);
    if (templates.length === 0) {
      return [];
    }

    // 3. Bulk insert them into project_work_activities
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const created = [];
      const qcList = await resolveQcChecklist(tenantId, trade);
      for (const tpl of templates) {
        // Check if this activity already exists in this project, room, and trade to prevent duplicates
        const dupRes = await client.query(`
          SELECT id FROM project_work_activities
          WHERE tenant_id = $1 AND project_id = $2 AND phase_id = $3
            AND room_name = $4 AND trade = $5 AND activity_name = $6
        `, [tenantId, projectId, phaseId, roomName, trade, tpl.activity_name]);

        if (dupRes.rows.length > 0) {
          continue; // skip duplicate
        }

        const res = await client.query(`
          INSERT INTO project_work_activities (
            tenant_id, project_id, phase_id, room_name, trade, activity_name, description, status, qc_checklist
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'todo', $8)
          RETURNING *
        `, [tenantId, projectId, phaseId, roomName, trade, tpl.activity_name, tpl.description, JSON.stringify(qcList)]);
        
        created.push(res.rows[0]);
      }

      // Auto-link dependencies based on standard templates
      if (created.length > 0) {
        // Find standard dependencies for this trade
        const { rows: depTemplates } = await client.query(`
          SELECT depends_on_trade FROM trade_dependency_templates 
          WHERE trade = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
        `, [trade, tenantId]);

        if (depTemplates.length > 0) {
          const dependsOnTrades = depTemplates.map(d => d.depends_on_trade);
          
          // Find existing activities in this room for those trades
          const { rows: existingActivities } = await client.query(`
            SELECT id, trade FROM project_work_activities
            WHERE tenant_id = $1 AND project_id = $2 AND room_name = $3 AND trade = ANY($4)
          `, [tenantId, projectId, roomName, dependsOnTrades]);

          // Create dependencies for each newly created activity
          for (const newAct of created) {
            for (const existingAct of existingActivities) {
              await client.query(`
                INSERT INTO work_activity_dependencies (tenant_id, project_id, activity_id, depends_on_activity_id)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (activity_id, depends_on_activity_id) DO NOTHING
              `, [tenantId, projectId, newAct.id, existingAct.id]);
            }
          }
        }
        
        // Also check if any existing activities in this room depend on the newly created trade
        const { rows: reverseDepTemplates } = await client.query(`
          SELECT trade FROM trade_dependency_templates 
          WHERE depends_on_trade = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
        `, [trade, tenantId]);
        
        if (reverseDepTemplates.length > 0) {
          const dependentTrades = reverseDepTemplates.map(d => d.trade);
          
          // Find existing activities in this room that depend on the newly created activities
          const { rows: existingDependentActivities } = await client.query(`
            SELECT id, trade FROM project_work_activities
            WHERE tenant_id = $1 AND project_id = $2 AND room_name = $3 AND trade = ANY($4)
          `, [tenantId, projectId, roomName, dependentTrades]);
          
          for (const newAct of created) {
            for (const existingDepAct of existingDependentActivities) {
              await client.query(`
                INSERT INTO work_activity_dependencies (tenant_id, project_id, activity_id, depends_on_activity_id)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (activity_id, depends_on_activity_id) DO NOTHING
              `, [tenantId, projectId, existingDepAct.id, newAct.id]);
            }
          }
        }
      }

      await client.query('COMMIT');
      return created;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // --- Trade Dependency Templates ---
  
  async findTradeDependencyTemplates(tenantId) {
    const { rows } = await pool.query(`
      SELECT * FROM trade_dependency_templates 
      WHERE tenant_id = $1 OR tenant_id IS NULL
      ORDER BY trade ASC
    `, [tenantId]);
    return rows;
  }

  async createTradeDependencyTemplate(tenantId, data) {
    const { trade, depends_on_trade } = data;
    const { rows } = await pool.query(`
      INSERT INTO trade_dependency_templates (tenant_id, trade, depends_on_trade)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [tenantId, trade, depends_on_trade]);
    return rows[0];
  }

  async deleteTradeDependencyTemplate(id, tenantId) {
    const { rowCount } = await pool.query(`
      DELETE FROM trade_dependency_templates
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    if (rowCount === 0) throw new Error('NOT_FOUND');
    return true;
  }
}

module.exports = new WorkActivityRepository();
