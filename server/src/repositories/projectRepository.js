const pool = require('../config/db');

class ProjectRepository {
  async createProject(tenantId, data, dbClient = pool) {
    const {
      lead_id, client_name, client_phone, client_email,
      name, project_type, pm_id, designer_id,
      contract_value, booking_amount = 0, status = 'active', start_date, target_date,
      site_address, custom_fields = {}, created_by,
      agreement_signed_by, agreement_signed_at, agreement_signature_method,
      payment_terms,
      flat_number, floor, building_name, street, city, pincode, landmark, latitude, longitude,
      builder_name, society_name, rera_id, noc_status, occupancy_certificate_status, property_handover_date,
      carpet_area, built_up_area, number_of_rooms,
      project_category, project_sub_category, property_type, property_age, renovation_scope, segment,
      allowed_design_revisions = 3, current_design_revisions = 0,
      pm_hours_allocated = 10, designer_hours_allocated = 20,
      fire_noc_status = 'pending', occupancy_permit_status = 'pending',
      retention_money_percentage = 0.00, ld_clause_details = null, stakeholder_complexity = 'low',
      spouse_name, spouse_phone, spouse_email,
      number_of_family_members, lifestyle_preferences, preferred_communication_channel,
      lift_availability, lift_dimensions, staircase_access, working_hour_window,
      society_contact, parking_permission, unloading_area, noc_requirements,
      key_holder_name, key_holder_phone, spare_key_location, gate_pass_number,
      access_card_holder, access_time_restrictions,
      lead_designer_id, junior_designer_id, site_engineer_id, qc_engineer_id,
      site_supervisor_id, crm_executive_id, procurement_officer_id,
      stage_revision_limits, stage_revision_counts,
      installation_warranty_start_date, installation_warranty_end_date,
      installation_warranty_scope, installation_warranty_status
    } = data;

    const query = `
      INSERT INTO projects (
        tenant_id, lead_id, client_name, client_phone, client_email,
        name, project_type, pm_id, designer_id,
        contract_value, booking_amount, status, start_date, target_date,
        site_address, custom_fields, created_by,
        agreement_signed_by, agreement_signed_at, agreement_signature_method,
        payment_terms,
        flat_number, floor, building_name, street, city, pincode, landmark, latitude, longitude,
        builder_name, society_name, rera_id, noc_status, occupancy_certificate_status, property_handover_date,
        carpet_area, built_up_area, number_of_rooms,
        project_category, project_sub_category, property_type, property_age, renovation_scope, segment,
        allowed_design_revisions, current_design_revisions,
        pm_hours_allocated, designer_hours_allocated,
        fire_noc_status, occupancy_permit_status,
        retention_money_percentage, ld_clause_details, stakeholder_complexity,
        spouse_name, spouse_phone, spouse_email,
        number_of_family_members, lifestyle_preferences, preferred_communication_channel,
        lift_availability, lift_dimensions, staircase_access, working_hour_window,
        society_contact, parking_permission, unloading_area, noc_requirements,
        key_holder_name, key_holder_phone, spare_key_location, gate_pass_number,
        access_card_holder, access_time_restrictions,
        lead_designer_id, junior_designer_id, site_engineer_id, qc_engineer_id,
        site_supervisor_id, crm_executive_id, procurement_officer_id,
        stage_revision_limits, stage_revision_counts,
        installation_warranty_start_date, installation_warranty_end_date,
        installation_warranty_scope, installation_warranty_status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36,
        $37, $38, $39,
        $40, $41, $42, $43, $44, $45, $46, $47, $48, $49,
        $50, $51, $52, $53, $54,
        $55, $56, $57, $58, $59, $60,
        $61, $62, $63, $64, $65, $66, $67, $68,
        $69, $70, $71, $72, $73, $74,
        $75, $76, $77, $78, $79, $80, $81, $82, $83,
        $84, $85, $86, $87
      ) RETURNING *
    `;
    const values = [
      tenantId, lead_id || null, client_name, client_phone || null, client_email || null,
      name, project_type || null, pm_id || null, designer_id || null,
      contract_value || null, booking_amount, status, start_date || null, target_date || null,
      site_address || null, custom_fields, created_by || null,
      agreement_signed_by || null, agreement_signed_at || null, agreement_signature_method || null,
      payment_terms || null,
      flat_number || null,
      floor || null,
      building_name || null,
      street || null,
      city || null,
      pincode || null,
      landmark || null,
      latitude !== undefined && latitude !== null ? Number(latitude) : null,
      longitude !== undefined && longitude !== null ? Number(longitude) : null,
      builder_name || null,
      society_name || null,
      rera_id || null,
      noc_status || 'pending',
      occupancy_certificate_status || 'pending',
      property_handover_date || null,
      carpet_area !== undefined && carpet_area !== null ? Number(carpet_area) : null,
      built_up_area !== undefined && built_up_area !== null ? Number(built_up_area) : null,
      number_of_rooms !== undefined && number_of_rooms !== null ? Number(number_of_rooms) : null,
      project_category || null,
      project_sub_category || null,
      property_type || null,
      property_age || null,
      renovation_scope || null,
      segment || null,
      allowed_design_revisions,
      current_design_revisions,
      pm_hours_allocated !== undefined && pm_hours_allocated !== null ? Number(pm_hours_allocated) : 10,
      designer_hours_allocated !== undefined && designer_hours_allocated !== null ? Number(designer_hours_allocated) : 20,
      fire_noc_status,
      occupancy_permit_status,
      retention_money_percentage !== undefined && retention_money_percentage !== null ? Number(retention_money_percentage) : 0.00,
      ld_clause_details,
      stakeholder_complexity,
      spouse_name || null,
      spouse_phone || null,
      spouse_email || null,
      number_of_family_members !== undefined && number_of_family_members !== null ? Number(number_of_family_members) : null,
      lifestyle_preferences || null,
      preferred_communication_channel || null,
      lift_availability || null,
      lift_dimensions || null,
      staircase_access || null,
      working_hour_window || null,
      society_contact || null,
      parking_permission || null,
      unloading_area || null,
      noc_requirements || null,
      key_holder_name || null,
      key_holder_phone || null,
      spare_key_location || null,
      gate_pass_number || null,
      access_card_holder || null,
      access_time_restrictions || null,
      lead_designer_id || null,
      junior_designer_id || null,
      site_engineer_id || null,
      qc_engineer_id || null,
      site_supervisor_id || null,
      crm_executive_id || null,
      procurement_officer_id || null,
      stage_revision_limits || '{}',
      stage_revision_counts || '{}',
      installation_warranty_start_date || null,
      installation_warranty_end_date || null,
      installation_warranty_scope || null,
      installation_warranty_status || 'active'
    ];

    const { rows } = await dbClient.query(query, values);
    return rows[0];
  }

  async findProjectById(tenantId, projectId) {
    const query = `
      SELECT p.*,
        pm.name as pm_name,
        d.name as designer_name,
        ld.name as lead_designer_name,
        jd.name as junior_designer_name,
        se.name as site_engineer_name,
        qe.name as qc_engineer_name,
        ss.name as site_supervisor_name,
        crm.name as crm_executive_name,
        po.name as procurement_officer_name
      FROM projects p
      LEFT JOIN users pm ON p.pm_id = pm.id
      LEFT JOIN users d ON p.designer_id = d.id
      LEFT JOIN users ld ON p.lead_designer_id = ld.id
      LEFT JOIN users jd ON p.junior_designer_id = jd.id
      LEFT JOIN users se ON p.site_engineer_id = se.id
      LEFT JOIN users qe ON p.qc_engineer_id = qe.id
      LEFT JOIN users ss ON p.site_supervisor_id = ss.id
      LEFT JOIN users crm ON p.crm_executive_id = crm.id
      LEFT JOIN users po ON p.procurement_officer_id = po.id
      WHERE p.tenant_id = $1 AND p.id = $2 AND p.deleted_at IS NULL
    `;
    const { rows } = await pool.query(query, [tenantId, projectId]);
    if (rows.length === 0) return null;

    const project = rows[0];

    // Fetch phases + task count per phase
    const phasesQuery = `
      SELECT pp.*,
        (
          SELECT count(t.id)::int 
          FROM tasks t 
          JOIN milestones m ON t.milestone_id = m.id 
          WHERE m.phase_id = pp.id AND t.tenant_id = $1 AND t.deleted_at IS NULL
        ) as task_count,
        COALESCE(
          (
            SELECT ROUND(COUNT(CASE WHEN pwa.status = 'completed' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2)
            FROM project_work_activities pwa
            WHERE pwa.phase_id = pp.id AND pwa.tenant_id = $1
          ),
          CASE WHEN pp.status = 'completed' THEN 100.00 ELSE 0.00 END
        )::numeric(5,2) as progress_percentage
      FROM project_phases pp
      WHERE pp.tenant_id = $1 AND pp.project_id = $2
      ORDER BY pp.sort_order ASC, pp.created_at ASC
    `;
    const phasesRes = await pool.query(phasesQuery, [tenantId, projectId]);
    project.phases = phasesRes.rows;

    // Fetch payment milestones
    const paymentsQuery = `
      SELECT * FROM payment_milestones
      WHERE tenant_id = $1 AND project_id = $2
      ORDER BY due_date ASC NULLS LAST, created_at ASC
    `;
    const paymentsRes = await pool.query(paymentsQuery, [tenantId, projectId]);
    project.payment_milestones = paymentsRes.rows;

    // Fetch project contacts
    const contactsQuery = `
      SELECT * FROM project_contacts
      WHERE tenant_id = $1 AND project_id = $2
      ORDER BY created_at ASC
    `;
    const contactsRes = await pool.query(contactsQuery, [tenantId, projectId]);
    project.contacts = contactsRes.rows;

    // Fetch project measurements
    const measurementsQuery = `
      SELECT * FROM project_measurements
      WHERE tenant_id = $1 AND project_id = $2
      ORDER BY created_at ASC
    `;
    const measurementsRes = await pool.query(measurementsQuery, [tenantId, projectId]);
    project.measurements = measurementsRes.rows;

    // Fetch project vendors
    const vendorsQuery = `
      SELECT * FROM project_vendors
      WHERE tenant_id = $1 AND project_id = $2
      ORDER BY created_at ASC
    `;
    const vendorsRes = await pool.query(vendorsQuery, [tenantId, projectId]);
    project.vendors = vendorsRes.rows;

    // Fetch project consultants
    const consultantsQuery = `
      SELECT * FROM project_consultants
      WHERE tenant_id = $1 AND project_id = $2
      ORDER BY created_at ASC
    `;
    const consultantsRes = await pool.query(consultantsQuery, [tenantId, projectId]);
    project.consultants = consultantsRes.rows;

    // Fetch project site team
    const siteTeamQuery = `
      SELECT pst.*, pv.vendor_name
      FROM project_site_team pst
      LEFT JOIN project_vendors pv ON pst.vendor_id = pv.id
      WHERE pst.tenant_id = $1 AND pst.project_id = $2
      ORDER BY pst.created_at ASC
    `;
    const siteTeamRes = await pool.query(siteTeamQuery, [tenantId, projectId]);
    project.site_team = siteTeamRes.rows;

    // Fetch project booking details
    const bookingRes = await pool.query(
      `SELECT pb.*, 
              u_des.name as designer_name,
              u_conf.name as confirmed_by_name
       FROM project_bookings pb
       LEFT JOIN users u_des ON pb.assigned_designer_id = u_des.id
       LEFT JOIN users u_conf ON pb.confirmed_by = u_conf.id
       WHERE pb.tenant_id = $1 AND pb.project_id = $2`,
      [tenantId, projectId]
    );
    project.booking = bookingRes.rows[0] || null;

    return project;
  }

  async findProjects(tenantId, { status, pmId, designerId, search, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const values = [tenantId];
    let whereClause = `p.tenant_id = $1 AND p.deleted_at IS NULL`;
    let idx = 2;

    if (status) {
      whereClause += ` AND p.status = $${idx++}`;
      values.push(status);
    }
    if (pmId) {
      whereClause += ` AND p.pm_id = $${idx++}`;
      values.push(pmId);
    }
    if (designerId) {
      whereClause += ` AND p.designer_id = $${idx++}`;
      values.push(designerId);
    }
    if (search) {
      whereClause += ` AND (p.name ILIKE $${idx} OR p.client_name ILIKE $${idx})`;
      values.push(`%${search}%`);
      idx++;
    }

    const countQuery = `SELECT count(*)::int FROM projects p WHERE ${whereClause}`;
    const { rows: countRows } = await pool.query(countQuery, values);
    const total = countRows[0].count;

    const query = `
      SELECT p.*,
        pm.name as pm_name,
        d.name as designer_name,
        ld.name as lead_designer_name,
        jd.name as junior_designer_name,
        se.name as site_engineer_name,
        qe.name as qc_engineer_name,
        ss.name as site_supervisor_name,
        crm.name as crm_executive_name,
        po.name as procurement_officer_name,
        (SELECT count(id)::int FROM project_phases WHERE project_id = p.id AND tenant_id = $1) as phase_count,
        (SELECT count(id)::int FROM project_phases WHERE project_id = p.id AND tenant_id = $1 AND status = 'completed') as completed_phase_count,
        (SELECT count(id)::int FROM tasks WHERE project_id = p.id AND tenant_id = $1 AND deleted_at IS NULL) as total_tasks,
        (SELECT count(id)::int FROM tasks WHERE project_id = p.id AND tenant_id = $1 AND deleted_at IS NULL AND status = 'done') as completed_tasks
      FROM projects p
      LEFT JOIN users pm ON p.pm_id = pm.id
      LEFT JOIN users d ON p.designer_id = d.id
      LEFT JOIN users ld ON p.lead_designer_id = ld.id
      LEFT JOIN users jd ON p.junior_designer_id = jd.id
      LEFT JOIN users se ON p.site_engineer_id = se.id
      LEFT JOIN users qe ON p.qc_engineer_id = qe.id
      LEFT JOIN users ss ON p.site_supervisor_id = ss.id
      LEFT JOIN users crm ON p.crm_executive_id = crm.id
      LEFT JOIN users po ON p.procurement_officer_id = po.id
      WHERE ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${idx++} OFFSET $${idx}
    `;
    
    values.push(limit, offset);
    const { rows } = await pool.query(query, values);

    return {
      data: rows,
      total,
      page,
      limit
    };
  }

  async updateProject(tenantId, projectId, updates, dbClient = pool) {
    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (['id', 'tenant_id', 'created_at', 'deleted_at'].includes(key)) continue;
      fields.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }

    if (fields.length === 0) return this.findProjectById(tenantId, projectId);

    fields.push(`updated_at = NOW()`);
    values.push(tenantId, projectId);

    const query = `
      UPDATE projects
      SET ${fields.join(', ')}
      WHERE tenant_id = $${idx} AND id = $${idx + 1} AND deleted_at IS NULL
      RETURNING *
    `;

    const { rows } = await dbClient.query(query, values);
    if (rows.length === 0) throw new Error('NOT_FOUND');
    return rows[0];
  }

  async softDeleteProject(tenantId, projectId) {
    const query = `
      UPDATE projects
      SET deleted_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
      RETURNING id
    `;
    const { rows } = await pool.query(query, [tenantId, projectId]);
    if (rows.length === 0) throw new Error('NOT_FOUND');
    return true;
  }

  async getProjectStats(tenantId, projectId) {
    const tasksQuery = `
      SELECT 
        COUNT(id)::int as total_tasks,
        COUNT(id) FILTER (WHERE status = 'done')::int as completed_tasks,
        COUNT(id) FILTER (WHERE status != 'done' AND due_date < CURRENT_DATE)::int as overdue_tasks
      FROM tasks
      WHERE tenant_id = $1 AND project_id = $2 AND deleted_at IS NULL
    `;
    const { rows: taskRows } = await pool.query(tasksQuery, [tenantId, projectId]);
    const taskStats = taskRows[0] || { total_tasks: 0, completed_tasks: 0, overdue_tasks: 0 };

    const paymentsQuery = `
      SELECT 
        COALESCE(SUM(amount), 0) as total_payment,
        COALESCE(SUM(paid_amount), 0) as collected_payment
      FROM payment_milestones
      WHERE tenant_id = $1 AND project_id = $2
    `;
    const { rows: paymentRows } = await pool.query(paymentsQuery, [tenantId, projectId]);
    const payStats = paymentRows[0] || { total_payment: 0, collected_payment: 0 };

    // Credit Notes Total
    const creditsQuery = `
      SELECT COALESCE(SUM(total_amount), 0) as total_credits
      FROM credit_notes
      WHERE tenant_id = $1 AND project_id = $2 AND status = 'issued'
    `;
    const { rows: creditRows } = await pool.query(creditsQuery, [tenantId, projectId]);
    const totalCredits = Number(creditRows[0]?.total_credits || 0);

    // Refunds Total
    const refundsQuery = `
      SELECT COALESCE(SUM(amount), 0) as total_refunds
      FROM refunds
      WHERE tenant_id = $1 AND project_id = $2 AND status = 'processed'
    `;
    const { rows: refundRows } = await pool.query(refundsQuery, [tenantId, projectId]);
    const totalRefunds = Number(refundRows[0]?.total_refunds || 0);

    // Overdue payments total
    const overdueQuery = `
      SELECT COALESCE(SUM(amount), 0) as overdue_payments
      FROM payment_milestones
      WHERE tenant_id = $1 AND project_id = $2 AND status != 'paid' AND due_date < CURRENT_DATE
    `;
    const { rows: overdueRows } = await pool.query(overdueQuery, [tenantId, projectId]);
    const overduePayments = Number(overdueRows[0]?.overdue_payments || 0);

    // Pending invoices total
    const pendingInvoicesQuery = `
      SELECT COALESCE(SUM(amount), 0) as pending_invoices
      FROM payment_milestones
      WHERE tenant_id = $1 AND project_id = $2 AND status = 'invoice_raised'
    `;
    const { rows: pendingInvoicesRows } = await pool.query(pendingInvoicesQuery, [tenantId, projectId]);
    const pendingInvoices = Number(pendingInvoicesRows[0]?.pending_invoices || 0);

    // BOQ values tracking
    const boqStatsQuery = `
      WITH latest_quotation AS (
        SELECT id FROM quotations
        WHERE tenant_id = $1 AND project_id = $2
        ORDER BY version DESC, created_at DESC
        LIMIT 1
      )
      SELECT 
        COALESCE(SUM(qi.total_price) FILTER (WHERE qi.scope_type = 'original'), 0) as original_scope_total,
        COALESCE(SUM(qi.total_price) FILTER (WHERE qi.scope_type = 'addition' AND (qi.change_order_id IS NULL OR pco.status = 'approved')), 0) as additions_total,
        COALESCE(SUM(qi.total_price) FILTER (WHERE qi.scope_type = 'reduction' AND (qi.change_order_id IS NULL OR pco.status = 'approved')), 0) as reductions_total
      FROM quotation_items qi
      LEFT JOIN project_change_orders pco ON qi.change_order_id = pco.id
      WHERE qi.tenant_id = $1 AND qi.quotation_id = (SELECT id FROM latest_quotation)
    `;
    const { rows: boqRows } = await pool.query(boqStatsQuery, [tenantId, projectId]);
    const boqStats = boqRows[0] || { original_scope_total: 0, additions_total: 0, reductions_total: 0 };

    // Timeline impact days from approved change orders
    const timelineQuery = `
      SELECT COALESCE(SUM(timeline_impact_days), 0) as approved_timeline_impact_days
      FROM project_change_orders
      WHERE tenant_id = $1 AND project_id = $2 AND status = 'approved'
    `;
    const { rows: timelineRows } = await pool.query(timelineQuery, [tenantId, projectId]);
    const approvedTimelineImpactDays = Number(timelineRows[0]?.approved_timeline_impact_days || 0);

    const projectQuery = `SELECT contract_value FROM projects WHERE tenant_id = $1 AND id = $2`;
    const { rows: projectRows } = await pool.query(projectQuery, [tenantId, projectId]);
    const contractValue = projectRows[0]?.contract_value ? Number(projectRows[0].contract_value) : 0;

    let originalScopeTotal = Number(boqStats.original_scope_total || 0);
    let additionsTotal = Number(boqStats.additions_total || 0);
    let reductionsTotal = Number(boqStats.reductions_total || 0);
    let netContractValue = originalScopeTotal + additionsTotal - reductionsTotal;

    if (originalScopeTotal === 0 && additionsTotal === 0 && reductionsTotal === 0) {
      originalScopeTotal = contractValue;
      netContractValue = contractValue;
    }

    // Expenses Tracking query
    const expensesQuery = `
      SELECT 
        COALESCE(SUM(amount), 0) as total_cost,
        COALESCE(SUM(amount) FILTER (WHERE category = 'material'), 0) as material_cost,
        COALESCE(SUM(amount) FILTER (WHERE category = 'labour'), 0) as labour_cost,
        COALESCE(SUM(amount) FILTER (WHERE category = 'vendor'), 0) as vendor_cost,
        COALESCE(SUM(amount) FILTER (WHERE category = 'overhead'), 0) as overhead_cost
      FROM project_expenses
      WHERE tenant_id = $1 AND project_id = $2 AND type = 'actual'
    `;
    const { rows: expenseRows } = await pool.query(expensesQuery, [tenantId, projectId]);
    const expStats = expenseRows[0] || { total_cost: 0, material_cost: 0, labour_cost: 0, vendor_cost: 0, overhead_cost: 0 };
    
    const totalActualCost = Number(expStats.total_cost);

    const totalPayment = Number(payStats.total_payment);
    const collectedPayment = Number(payStats.collected_payment);

    const netBilled = Math.max(0, totalPayment - totalCredits);
    const netCollections = Math.max(0, collectedPayment - totalRefunds);
    const outstandingBalance = Math.max(0, netBilled - netCollections);

    const grossProfit = netContractValue - totalActualCost;
    const grossMarginPct = netContractValue > 0 ? Math.round((grossProfit / netContractValue) * 100) : 0;

    let taskCompletionPct = 0;
    if (taskStats.total_tasks > 0) {
      taskCompletionPct = Math.round((taskStats.completed_tasks / taskStats.total_tasks) * 100);
    }

    return {
      totalTasks: taskStats.total_tasks,
      completedTasks: taskStats.completed_tasks,
      taskCompletionPct,
      overdueTasks: taskStats.overdue_tasks,
      totalPayment,
      collectedPayment,
      totalCredits,
      totalRefunds,
      overduePayments,
      pendingInvoices,
      netBilled,
      netCollections,
      outstandingBalance,
      totalActualCost,
      grossProfit,
      grossMarginPct,
      costBreakdown: {
        material: Number(expStats.material_cost),
        labour: Number(expStats.labour_cost),
        vendor: Number(expStats.vendor_cost),
        overhead: Number(expStats.overhead_cost)
      },
      originalScopeTotal,
      additionsTotal,
      reductionsTotal,
      netContractValue,
      approvedTimelineImpactDays
    };
  }
}

module.exports = new ProjectRepository();
