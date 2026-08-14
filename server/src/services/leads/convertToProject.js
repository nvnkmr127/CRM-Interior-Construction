const logger = require('../../utils/logger');
const pool = require('../../db/pool');
const { createProject } = require('../projects/createProject');
const { buildApprovalChain } = require('../../utils/ApprovalChainBuilder');
const { getTenantThreshold } = require('../../utils/finance');

async function convertToProject({ tenantId, userId, leadId, bodyData }) {
  logger.info('[convertToProject] START', { tenantId, userId, leadId });

  // 1. Fetch lead
  const leadRes = await pool.query(
    'SELECT * FROM leads WHERE id = $1 AND tenant_id = $2',
    [leadId, tenantId]
  );
  if (leadRes.rowCount === 0) {
    const error = new Error('Lead not found');
    error.code = 'NOT_FOUND';
    throw error;
  }
  const lead = leadRes.rows[0];

  // 2. Checklist validation
  // Get tenant config setting
  const tenantRes = await pool.query(
    'SELECT config FROM tenants WHERE id = $1',
    [tenantId]
  );
  const tenantConfig = tenantRes.rows[0]?.config || {};
  const checklistConfig = tenantConfig.pre_conversion_checklist || [
    { key: 'contract_signed', label: 'Contract signed', required: true, active: true },
    { key: 'booking_received', label: 'Booking amount received', required: true, active: true },
    { key: 'scope_finalized', label: 'Scope frozen', required: true, active: true },
    { key: 'site_visit_completed', label: 'Site visit completed', required: true, active: true }
  ];

  const missingFields = [];
  for (const item of checklistConfig) {
    if (item.active && item.required && !bodyData[item.key]) {
      missingFields.push(item.key);
    }
  }

  if (!bodyData.projectName || !bodyData.projectName.trim()) missingFields.push('projectName');
  if (!bodyData.projectType) missingFields.push('projectType');
  if (!bodyData.contract_file_key) missingFields.push('contract_file_key');

  if (missingFields.length > 0) {
    const error = new Error(`Missing required fields: ${missingFields.join(', ')}`);
    error.code = 'VALIDATION_ERROR';
    error.missingFields = missingFields;
    throw error;
  }

  // 3. Create the project using the createProject service
  const advanceAmount = Number(bodyData.advanceAmount) || 0;
  const paymentTerms = bodyData.paymentTerms || null;
  const projectStatus = (advanceAmount > 0 || paymentTerms) ? 'pending_payment' : 'active';

  const newProjectData = {
    name: bodyData.projectName,
    client_name: bodyData.clientName,
    client_phone: bodyData.clientPhone,
    client_email: bodyData.clientEmail,
    project_type: bodyData.projectType,
    contract_value: bodyData.contractValue ? Number(bodyData.contractValue) : 0,
    booking_amount: advanceAmount,
    payment_terms: paymentTerms,
    pm_id: bodyData.pm || null,
    designer_id: bodyData.designer || null,
    start_date: bodyData.startDate || null,
    target_date: bodyData.handoverDate || null,
    agreement_signed_by: bodyData.agreement_signed_by || null,
    agreement_signed_at: bodyData.agreement_signed_at || null,
    agreement_signature_method: bodyData.agreement_signature_method || null,
    contract_file_key: bodyData.contract_file_key,
    contract_file_name: bodyData.contract_file_name,
    contract_file_size: bodyData.contract_file_size ? Number(bodyData.contract_file_size) : null,
    contract_file_mime: bodyData.contract_file_mime,
    lead_id: leadId,
    status: projectStatus,
    
    // Address fields
    flat_number: bodyData.flat_number || '',
    floor: bodyData.floor || '',
    building_name: bodyData.building_name || '',
    street: bodyData.street || '',
    city: bodyData.city || '',
    pincode: bodyData.pincode || '',
    landmark: bodyData.landmark || '',
    latitude: bodyData.latitude ? Number(bodyData.latitude) : null,
    longitude: bodyData.longitude ? Number(bodyData.longitude) : null,
    builder_name: bodyData.builder_name || '',
    society_name: bodyData.society_name || '',
    rera_id: bodyData.rera_id || '',
    noc_status: bodyData.noc_status || 'pending',
    occupancy_certificate_status: bodyData.occupancy_certificate_status || 'pending',
    property_handover_date: bodyData.property_handover_date || null,
    carpet_area: bodyData.carpet_area ? Number(bodyData.carpet_area) : null,
    built_up_area: bodyData.built_up_area ? Number(bodyData.built_up_area) : null,
    number_of_rooms: bodyData.number_of_rooms ? Number(bodyData.number_of_rooms) : null,
    project_category: bodyData.project_category || null,
    project_sub_category: bodyData.project_sub_category || null,
    property_type: bodyData.property_type || null,
    property_age: bodyData.property_age || null,
    renovation_scope: bodyData.renovation_scope || null,
    segment: bodyData.segment || null,
    
    contacts: bodyData.contacts || [],
    measurements: bodyData.measurements || [],
    vendors: bodyData.vendors || [],
    consultants: bodyData.consultants || []
  };

  const project = await createProject({
    tenantId,
    userId,
    data: newProjectData
  });

  const projectId = project.id;

  // Update status of project to projectStatus if createProject sets it to pending_booking
  await pool.query(
    'UPDATE projects SET status = $1 WHERE id = $2 AND tenant_id = $3',
    [projectStatus, projectId, tenantId]
  );

  // 4. Handle advance payment split and approval routing if advanceAmount > 0
  if (advanceAmount > 0) {
    // Get milestones sorted by order/created_at to split payments correctly
    const pmilRes = await pool.query(
      `SELECT id, name, amount FROM payment_milestones 
       WHERE project_id = $1 AND tenant_id = $2 
       ORDER BY due_date ASC, created_at ASC`,
      [projectId, tenantId]
    );

    if (pmilRes.rowCount > 0) {
      const milestones = pmilRes.rows;
      const firstMilestone = milestones[0];
      const secondMilestone = milestones[1];

      // Mark first milestone as pending_approval
      await pool.query(
        "UPDATE payment_milestones SET status = 'pending_approval' WHERE id = $1 AND tenant_id = $2",
        [firstMilestone.id, tenantId]
      );

      // Determine split allocations (Option B)
      const firstMilestoneAmt = Number(firstMilestone.amount) || 0;
      const splits = [];
      if (advanceAmount <= firstMilestoneAmt) {
        splits.push({
          milestoneId: firstMilestone.id,
          milestoneName: firstMilestone.name,
          amount: advanceAmount,
          status: 'paid'
        });
      } else {
        splits.push({
          milestoneId: firstMilestone.id,
          milestoneName: firstMilestone.name,
          amount: firstMilestoneAmt,
          status: 'paid'
        });
        const remainder = advanceAmount - firstMilestoneAmt;
        if (secondMilestone) {
          const secondMilestoneAmt = Number(secondMilestone.amount) || 0;
          splits.push({
            milestoneId: secondMilestone.id,
            milestoneName: secondMilestone.name,
            amount: remainder,
            status: remainder >= secondMilestoneAmt ? 'paid' : 'partially_paid'
          });
        }
      }

      // Create a financial approval record
      const threshold = await getTenantThreshold(tenantId, 'finance_payment_threshold', 100000.00);
      const { current_stage, total_stages, approval_chain } = await buildApprovalChain(tenantId, 'payment_update', advanceAmount);
      
      await pool.query(
        `INSERT INTO financial_approvals (
           tenant_id, transaction_type, target_id, amount, requested_by, requested_changes, status, threshold_limit,
           current_stage, total_stages, approval_chain
         ) VALUES ($1, 'payment_update', $2, $3, $4, $5, 'pending', $6, $7, $8, $9)`,
        [
          tenantId, 
          firstMilestone.id, 
          advanceAmount, 
          userId, 
          JSON.stringify({ 
            type: 'update', 
            original_status: 'scheduled', 
            projectId: projectId,
            isSplit: true,
            splits: splits,
            data: { 
              status: 'paid', 
              paid_amount: advanceAmount, 
              paid_at: new Date().toISOString() 
            } 
          }), 
          threshold, 
          current_stage, 
          total_stages, 
          JSON.stringify(approval_chain)
        ]
      );
    }
  }

  // 5. Update lead status
  await pool.query(
    'UPDATE leads SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3',
    ['converted', leadId, tenantId]
  );

  return projectId;
}

module.exports = { convertToProject };
