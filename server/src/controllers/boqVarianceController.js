const pool = require('../db/pool');

exports.getPortfolioBOQVarianceReport = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    const query = `
      WITH target_quotation AS (
        SELECT DISTINCT ON (project_id) project_id, id, status, subtotal, total_amount
        FROM quotations
        WHERE tenant_id = $1
        ORDER BY project_id, (CASE WHEN status = 'accepted' THEN 1 ELSE 2 END) ASC, version DESC, created_at DESC
      ),
      boq_items AS (
        SELECT 
          qi.id,
          qi.quotation_id,
          qi.scope_type,
          qi.total_price,
          qi.quantity,
          qi.markup_percentage,
          q.project_id
        FROM quotation_items qi
        JOIN target_quotation q ON qi.quotation_id = q.id
        WHERE qi.tenant_id = $1
      ),
      substitutions AS (
        SELECT 
          ms.project_id,
          COALESCE(SUM(ms.price_difference * qi.quantity * (1 + (qi.markup_percentage / 100.0))), 0) as material_revisions_total
        FROM material_substitutions ms
        JOIN quotation_items qi ON ms.boq_item_id = qi.id
        WHERE ms.tenant_id = $1 AND ms.status = 'approved'
        GROUP BY ms.project_id
      )
      SELECT 
        p.id as project_id,
        p.name as project_name,
        p.client_name,
        p.status as project_status,
        COALESCE(p.contract_value, 0) as initial_contract_value,
        
        -- Original items total (which currently includes approved substitutions)
        COALESCE(SUM(bi.total_price) FILTER (WHERE bi.scope_type = 'original'), 0) as current_original_scope_total,
        
        -- Scope additions & reductions
        COALESCE(SUM(bi.total_price) FILTER (WHERE bi.scope_type = 'addition'), 0) as additions_total,
        COALESCE(SUM(bi.total_price) FILTER (WHERE bi.scope_type = 'reduction'), 0) as reductions_total,
        
        -- Material substitutions price difference
        COALESCE(s.material_revisions_total, 0) as material_revisions_total,
        
        -- Active quotation details
        tq.id as quotation_id,
        tq.status as quotation_status,
        COALESCE(tq.subtotal, 0) as quotation_subtotal,
        COALESCE(tq.total_amount, 0) as quotation_total_amount
      FROM projects p
      LEFT JOIN target_quotation tq ON p.id = tq.project_id
      LEFT JOIN boq_items bi ON p.id = bi.project_id
      LEFT JOIN substitutions s ON p.id = s.project_id
      WHERE p.tenant_id = $1 AND p.deleted_at IS NULL
      GROUP BY p.id, p.name, p.client_name, p.status, p.contract_value, tq.id, tq.status, tq.subtotal, tq.total_amount, s.material_revisions_total, p.created_at
      ORDER BY p.created_at DESC
    `;

    const { rows } = await pool.query(query, [tenantId]);

    const report = rows.map(row => {
      let originalSubtotal = parseFloat(row.current_original_scope_total) - parseFloat(row.material_revisions_total);
      let changeOrderSubtotal = parseFloat(row.additions_total) - parseFloat(row.reductions_total);
      let materialRevisionSubtotal = parseFloat(row.material_revisions_total);
      let currentSubtotal = parseFloat(row.quotation_subtotal);

      if (!row.quotation_id) {
        originalSubtotal = parseFloat(row.initial_contract_value || 0);
        changeOrderSubtotal = 0;
        materialRevisionSubtotal = 0;
        currentSubtotal = originalSubtotal;
      }

      const varianceAmount = currentSubtotal - originalSubtotal;
      const variancePercentage = originalSubtotal > 0 ? (varianceAmount / originalSubtotal) * 100 : 0;

      return {
        projectId: row.project_id,
        projectName: row.project_name,
        clientName: row.client_name,
        projectStatus: row.project_status,
        originalSubtotal,
        changeOrderSubtotal,
        materialRevisionSubtotal,
        currentSubtotal,
        currentTotal: row.quotation_id ? parseFloat(row.quotation_total_amount) : originalSubtotal,
        varianceAmount,
        variancePercentage
      };
    });

    return res.status(200).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

exports.getProjectBOQVarianceReport = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { projectId } = req.params;

    // Check project exists
    const projCheck = await pool.query('SELECT id, name, client_name, contract_value, status FROM projects WHERE id = $1 AND tenant_id = $2', [projectId, tenantId]);
    if (projCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    const project = projCheck.rows[0];

    // Find target quotation
    const quoteQuery = `
      SELECT id, status, subtotal, total_amount 
      FROM quotations 
      WHERE tenant_id = $1 AND project_id = $2
      ORDER BY (CASE WHEN status = 'accepted' THEN 1 ELSE 2 END) ASC, version DESC, created_at DESC
      LIMIT 1
    `;
    const quoteRes = await pool.query(quoteQuery, [tenantId, projectId]);
    const quotation = quoteRes.rows[0] || null;

    let summary = {
      originalSubtotal: parseFloat(project.contract_value || 0),
      changeOrderSubtotal: 0,
      materialRevisionSubtotal: 0,
      currentSubtotal: parseFloat(project.contract_value || 0),
      currentTotal: parseFloat(project.contract_value || 0),
      varianceAmount: 0,
      variancePercentage: 0
    };

    let changeOrders = [];
    let materialSubstitutions = [];
    let roomBreakdown = [];

    if (quotation) {
      // 1. Fetch boq items summary
      const itemsQuery = `
        SELECT 
          COALESCE(SUM(total_price) FILTER (WHERE scope_type = 'original'), 0) as current_original_scope_total,
          COALESCE(SUM(total_price) FILTER (WHERE scope_type = 'addition'), 0) as additions_total,
          COALESCE(SUM(total_price) FILTER (WHERE scope_type = 'reduction'), 0) as reductions_total
        FROM quotation_items
        WHERE tenant_id = $1 AND quotation_id = $2
      `;
      const itemsRes = await pool.query(itemsQuery, [tenantId, quotation.id]);
      const boqStats = itemsRes.rows[0];

      // 2. Fetch approved substitutions total
      const subQueryTotal = `
        SELECT 
          COALESCE(SUM(ms.price_difference * qi.quantity * (1 + (qi.markup_percentage / 100.0))), 0) as material_revisions_total
        FROM material_substitutions ms
        JOIN quotation_items qi ON ms.boq_item_id = qi.id
        WHERE ms.tenant_id = $1 AND ms.project_id = $2 AND ms.status = 'approved'
      `;
      const subResTotal = await pool.query(subQueryTotal, [tenantId, projectId]);
      const materialRevisionsTotal = parseFloat(subResTotal.rows[0]?.material_revisions_total || 0);

      const currentOriginalScopeTotal = parseFloat(boqStats.current_original_scope_total || 0);
      const additionsTotal = parseFloat(boqStats.additions_total || 0);
      const reductionsTotal = parseFloat(boqStats.reductions_total || 0);

      const originalSubtotal = currentOriginalScopeTotal - materialRevisionsTotal;
      const changeOrderSubtotal = additionsTotal - reductionsTotal;
      const currentSubtotal = parseFloat(quotation.subtotal || 0);

      const varianceAmount = currentSubtotal - originalSubtotal;
      const variancePercentage = originalSubtotal > 0 ? (varianceAmount / originalSubtotal) * 100 : 0;

      summary = {
        originalSubtotal,
        changeOrderSubtotal,
        materialRevisionSubtotal: materialRevisionsTotal,
        currentSubtotal,
        currentTotal: parseFloat(quotation.total_amount || 0),
        varianceAmount,
        variancePercentage
      };

      // 3. Fetch change orders and their items
      const coQuery = `
        SELECT id, title, description, reason, amount, timeline_impact_days, status, created_at 
        FROM project_change_orders 
        WHERE project_id = $1 AND tenant_id = $2 
        ORDER BY created_at ASC
      `;
      const coRes = await pool.query(coQuery, [projectId, tenantId]);
      changeOrders = coRes.rows;

      if (changeOrders.length > 0) {
        const coIds = changeOrders.map(co => co.id);
        const { rows: coItems } = await pool.query(
          `SELECT qi.id, qi.change_order_id, qi.room_or_area, qi.item_name, qi.unit, qi.quantity, qi.unit_price, qi.total_price, qi.scope_type
           FROM quotation_items qi
           WHERE qi.change_order_id = ANY($1) AND qi.tenant_id = $2
           ORDER BY qi.sort_order ASC, qi.created_at ASC`,
          [coIds, tenantId]
        );

        changeOrders.forEach(co => {
          co.items = coItems.filter(item => item.change_order_id === co.id);
        });
      }

      // 4. Fetch approved substitutions details
      const msQuery = `
        SELECT ms.id, ms.boq_item_id, ms.reason_shortage, 
               ms.original_item_name, ms.original_brand, ms.original_material_specifications, ms.original_unit_price,
               ms.replacement_item_name, ms.replacement_brand, ms.replacement_material_specifications, ms.replacement_unit_price,
               ms.price_difference, ms.client_approved_at,
               qi.quantity, qi.markup_percentage, qi.room_or_area
        FROM material_substitutions ms
        JOIN quotation_items qi ON ms.boq_item_id = qi.id
        WHERE ms.project_id = $1 AND ms.tenant_id = $2 AND ms.status = 'approved'
        ORDER BY ms.client_approved_at DESC
      `;
      const msRes = await pool.query(msQuery, [projectId, tenantId]);
      materialSubstitutions = msRes.rows.map(row => {
        const priceDiff = parseFloat(row.price_difference);
        const quantity = parseFloat(row.quantity || 0);
        const markup = parseFloat(row.markup_percentage || 0);
        const totalImpact = priceDiff * quantity * (1 + (markup / 100.0));
        return {
          id: row.id,
          boqItemId: row.boq_item_id,
          roomOrArea: row.room_or_area,
          reasonShortage: row.reason_shortage,
          originalName: row.original_item_name,
          originalBrand: row.original_brand,
          originalSpecs: row.original_material_specifications,
          originalUnitPrice: parseFloat(row.original_unit_price || 0),
          replacementName: row.replacement_item_name,
          replacementBrand: row.replacement_brand,
          replacementSpecs: row.replacement_material_specifications,
          replacementUnitPrice: parseFloat(row.replacement_unit_price || 0),
          priceDifference: priceDiff,
          quantity,
          markupPercentage: markup,
          totalImpact,
          clientApprovedAt: row.client_approved_at
        };
      });

      // 5. Fetch room breakdown
      const roomQuery = `
        SELECT 
          COALESCE(qi.room_or_area, 'Unassigned') as room_or_area,
          COALESCE(SUM(qi.total_price) FILTER (WHERE qi.scope_type = 'original'), 0) as current_original_total,
          COALESCE(SUM(qi.total_price) FILTER (WHERE qi.scope_type = 'addition'), 0) as additions_total,
          COALESCE(SUM(qi.total_price) FILTER (WHERE qi.scope_type = 'reduction'), 0) as reductions_total
        FROM quotation_items qi
        WHERE qi.tenant_id = $1 AND qi.quotation_id = $2
        GROUP BY COALESCE(qi.room_or_area, 'Unassigned')
        ORDER BY room_or_area ASC
      `;
      const roomRes = await pool.query(roomQuery, [tenantId, quotation.id]);
      
      // We also need approved substitutions price difference per room to compute original value accurately
      const roomSubQuery = `
        SELECT 
          COALESCE(qi.room_or_area, 'Unassigned') as room_or_area,
          COALESCE(SUM(ms.price_difference * qi.quantity * (1 + (qi.markup_percentage / 100.0))), 0) as material_revisions_total
        FROM material_substitutions ms
        JOIN quotation_items qi ON ms.boq_item_id = qi.id
        WHERE ms.tenant_id = $1 AND ms.project_id = $2 AND ms.status = 'approved'
        GROUP BY COALESCE(qi.room_or_area, 'Unassigned')
      `;
      const roomSubRes = await pool.query(roomSubQuery, [tenantId, projectId]);
      const roomSubMap = new Map(roomSubRes.rows.map(r => [r.room_or_area, parseFloat(r.material_revisions_total)]));

      roomBreakdown = roomRes.rows.map(row => {
        const roomName = row.room_or_area;
        const currentOriginal = parseFloat(row.current_original_total);
        const additions = parseFloat(row.additions_total);
        const reductions = parseFloat(row.reductions_total);
        const revisions = roomSubMap.get(roomName) || 0;

        const originalVal = currentOriginal - revisions;
        const currentVal = currentOriginal + additions - reductions;
        const varianceVal = currentVal - originalVal;

        return {
          roomOrArea: roomName,
          originalValue: originalVal,
          changeOrderValue: additions - reductions,
          materialRevisionValue: revisions,
          currentValue: currentVal,
          varianceAmount: varianceVal,
          variancePercentage: originalVal > 0 ? (varianceVal / originalVal) * 100 : 0
        };
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        project: {
          id: project.id,
          name: project.name,
          clientName: project.client_name,
          status: project.status
        },
        summary,
        changeOrders,
        materialSubstitutions,
        roomBreakdown
      }
    });
  } catch (error) {
    next(error);
  }
};
