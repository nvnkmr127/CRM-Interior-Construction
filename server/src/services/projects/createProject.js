const projectRepository = require('../../repositories/projectRepository');
const templateService = require('../templates/templateService');
const { logAction } = require('../auditLog');
const { enqueueAutomation } = require('../../queues/automationQueue');
const pool = require('../../config/db');

async function createProject({ tenantId, userId, data }) {
  const { 
    templateId, 
    contract_file_key, 
    contract_file_name, 
    contract_file_size, 
    contract_file_mime, 
    contacts,
    measurements,
    vendors,
    consultants,
    site_team,
    ...projectData 
  } = data;
  
  projectData.status = 'pending_booking';

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Create the base project
    const project = await projectRepository.createProject(tenantId, { 
      ...projectData, 
      created_by: userId 
    }, client);

    // 1.2. Create project contacts
    if (Array.isArray(contacts) && contacts.length > 0) {
      for (const contact of contacts) {
        if (!contact.name) continue;
        await client.query(`
          INSERT INTO project_contacts (
            tenant_id, project_id, name, phone, email, role, decision_authority, relationship_notes,
            contact_preference, approval_authority_level
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          tenantId,
          project.id,
          contact.name,
          contact.phone || null,
          contact.email || null,
          contact.role || 'co_owner',
          contact.decision_authority || 'Influencer',
          contact.relationship_notes || null,
          contact.contact_preference || null,
          contact.approval_authority_level || null
        ]);
      }
    }

    // 1.3. Create project room measurements
    if (Array.isArray(measurements) && measurements.length > 0) {
      for (const m of measurements) {
        if (!m.room_name) continue;
        const length = m.length !== undefined && m.length !== null ? Number(m.length) : 0;
        const width = m.width !== undefined && m.width !== null ? Number(m.width) : 0;
        const area = m.area !== undefined && m.area !== null ? Number(m.area) : (length * width);
        await client.query(`
          INSERT INTO project_measurements (
            tenant_id, project_id, room_name, length, width, height, area, unit, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          tenantId,
          project.id,
          m.room_name,
          length,
          width,
          m.height !== undefined && m.height !== null ? Number(m.height) : 0,
          area,
          m.unit || 'feet',
          m.notes || null
        ]);
      }
    } else if (projectData.lead_id) {
      // Auto-clone from lead measurements if present
      const leadMeas = await client.query(
        'SELECT room_name, length, width, height, unit, notes FROM lead_measurements WHERE lead_id = $1 AND tenant_id = $2',
        [projectData.lead_id, tenantId]
      );
      for (const m of leadMeas.rows) {
        const length = m.length !== null ? Number(m.length) : 0;
        const width = m.width !== null ? Number(m.width) : 0;
        const area = length * width;
        await client.query(`
          INSERT INTO project_measurements (
            tenant_id, project_id, room_name, length, width, height, area, unit, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          tenantId,
          project.id,
          m.room_name,
          m.length,
          m.width,
          m.height,
          area,
          m.unit || 'feet',
          m.notes || null
        ]);
      }

      // Auto-clone lead preferences to project_design_requirements
      const leadPrefRes = await client.query(
        'SELECT * FROM lead_preferences WHERE lead_id = $1 AND tenant_id = $2 LIMIT 1',
        [projectData.lead_id, tenantId]
      );
      if (leadPrefRes.rows.length > 0) {
        const lp = leadPrefRes.rows[0];
        await client.query(`
          INSERT INTO project_design_requirements (
            tenant_id, project_id, interior_style, color_theme, material_preference,
            kitchen_style, wardrobe_style, lighting_preference, flooring_preference,
            lifestyle_inputs, must_haves, nice_to_haves,
            family_size, usage_patterns, storage_priorities, brand_flexibility, brand_remarks,
            existing_furniture, budget_category_allocation
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          ON CONFLICT (project_id) DO NOTHING
        `, [
          tenantId, project.id,
          lp.interior_style || null,
          lp.color_theme || null,
          lp.material || null,
          lp.kitchen_style || null,
          lp.wardrobe_style || null,
          lp.lighting || null,
          lp.flooring || null,
          null, null, null,
          lp.family_size || null,
          lp.usage_patterns || null,
          lp.storage_priorities || null,
          lp.brand_flexibility || null,
          lp.brand_remarks || null,
          lp.existing_furniture || null,
          lp.budget_category_allocation ? JSON.stringify(lp.budget_category_allocation) : '{}'
        ]);
      }

      // Auto-clone lead requirements to project_room_requirements
      const leadReqsRes = await client.query(
        'SELECT * FROM lead_requirements WHERE lead_id = $1 AND tenant_id = $2',
        [projectData.lead_id, tenantId]
      );
      for (const lr of leadReqsRes.rows) {
        await client.query(`
          INSERT INTO project_room_requirements (
            tenant_id, project_id, room_name, budget_allocation, priority, functional_requirements, remarks
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          tenantId, project.id,
          lr.room,
          lr.estimated_budget || null,
          lr.priority || null,
          lr.work_type || null,
          lr.remarks || null
        ]);
      }

      // Auto-clone lead inspirations to project_inspirations
      const leadInspRes = await client.query(
        'SELECT * FROM lead_inspirations WHERE lead_id = $1 AND tenant_id = $2',
        [projectData.lead_id, tenantId]
      );
      for (const li of leadInspRes.rows) {
        await client.query(`
          INSERT INTO project_inspirations (
            tenant_id, project_id, image_url, room_type, notes
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          tenantId, project.id,
          li.image_url,
          li.room_type || null,
          li.notes || null
        ]);
      }
    }

    // 1.4. Create project vendors
    const vendorNameToIdMap = {};
    if (Array.isArray(vendors) && vendors.length > 0) {
      for (const v of vendors) {
        if (!v.vendor_name) continue;
        const vendorInsertRes = await client.query(`
          INSERT INTO project_vendors (
            tenant_id, project_id, vendor_name, scope_of_work, agreed_rate, payment_terms, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [
          tenantId,
          project.id,
          v.vendor_name,
          v.scope_of_work || null,
          v.agreed_rate !== undefined && v.agreed_rate !== null ? Number(v.agreed_rate) : null,
          v.payment_terms || null,
          v.status || 'pending'
        ]);
        vendorNameToIdMap[v.vendor_name] = vendorInsertRes.rows[0].id;
      }
    }

    // 1.5. Create project consultants
    if (Array.isArray(consultants) && consultants.length > 0) {
      for (const c of consultants) {
        if (!c.name || !c.role) continue;
        await client.query(`
          INSERT INTO project_consultants (
            tenant_id, project_id, name, role, firm, email, phone
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          tenantId,
          project.id,
          c.name,
          c.role,
          c.firm || null,
          c.email || null,
          c.phone || null
        ]);
      }
    }

    // 1.6. Create project site team members
    if (Array.isArray(site_team) && site_team.length > 0) {
      for (const member of site_team) {
        if (!member.name || !member.role) continue;

        let finalVendorId = null;
        if (member.vendor_id) {
          finalVendorId = member.vendor_id;
        } else if (member.vendor_name && vendorNameToIdMap[member.vendor_name]) {
          finalVendorId = vendorNameToIdMap[member.vendor_name];
        }

        await client.query(`
          INSERT INTO project_site_team (
            tenant_id, project_id, vendor_id, role, name, phone, email, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          tenantId,
          project.id,
          finalVendorId,
          member.role,
          member.name,
          member.phone || null,
          member.email || null,
          member.status || 'active'
        ]);
      }
    }

    // Create contract document record if key is present
    if (contract_file_key) {
      await client.query(
        `INSERT INTO documents (
          tenant_id, project_id, name, doc_type, version, storage_key, file_size_bytes, mime_type, uploaded_by, status
        ) VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8, 'approved')`,
        [
          tenantId,
          project.id,
          contract_file_name,
          'contract',
          contract_file_key,
          contract_file_size || null,
          contract_file_mime || null,
          userId
        ]
      );
    }

    // 1.5. If payment_terms are set, generate the structured payment milestone schedule
    if (project.payment_terms && project.contract_value && Number(project.contract_value) > 0) {
      const contractVal = Number(project.contract_value);
      const templates = {
        '10_40_40_10': [
          { name: 'Booking Advance', pct: 10 },
          { name: 'Design Sign-off', pct: 40 },
          { name: 'Production Commencement', pct: 40 },
          { name: 'Handover', pct: 10 }
        ],
        '30_30_30_10': [
          { name: 'Booking Advance', pct: 30 },
          { name: 'Material Procurement', pct: 30 },
          { name: 'Mid-Execution', pct: 30 },
          { name: 'Handover', pct: 10 }
        ],
        '50_50': [
          { name: 'Booking Advance', pct: 50 },
          { name: 'Final Handover', pct: 50 }
        ]
      };

      let milestoneDefinitions = templates[project.payment_terms];
      if (!milestoneDefinitions) {
        const parts = project.payment_terms.split('_').map(Number);
        const total = parts.reduce((a, b) => a + b, 0);
        if (total === 100) {
          milestoneDefinitions = parts.map((pct, idx) => ({
            name: idx === 0 ? 'Booking Advance' : (idx === parts.length - 1 ? 'Handover' : `Installment ${idx + 1}`),
            pct
          }));
        }
      }

      if (milestoneDefinitions) {
        // Generate milestones
        for (const definition of milestoneDefinitions) {
          const amount = (contractVal * (definition.pct / 100)).toFixed(2);
          await client.query(`
            INSERT INTO payment_milestones (tenant_id, project_id, name, amount, percentage, status)
            VALUES ($1, $2, $3, $4, $5, 'scheduled')
          `, [tenantId, project.id, definition.name, amount, definition.pct]);
        }

        // Keep booking_amount in sync with the first milestone (Booking Advance)
        const firstInstallment = milestoneDefinitions[0];
        const firstAmount = Number((contractVal * (firstInstallment.pct / 100)).toFixed(2));
        await client.query(`
          UPDATE projects
          SET booking_amount = $1
          WHERE id = $2 AND tenant_id = $3
        `, [firstAmount, project.id, tenantId]);
        project.booking_amount = firstAmount;
      }
    } else if (project.booking_amount && Number(project.booking_amount) > 0) {
      // Fallback: single Booking Advance milestone if no payment terms are specified
      const contractVal = Number(project.contract_value || project.booking_amount);
      const percentage = contractVal > 0 
        ? ((Number(project.booking_amount) / contractVal) * 100).toFixed(2)
        : 100.00;

      await client.query(`
        INSERT INTO payment_milestones (tenant_id, project_id, name, amount, percentage, status)
        VALUES ($1, $2, 'Booking Advance', $3, $4, 'scheduled')
      `, [tenantId, project.id, Number(project.booking_amount), percentage]);
    }

    // 2. Hydrate via template if requested
    if (templateId) {
      try {
        await templateService.applyTemplate(project.id, templateId, tenantId, client);
      } catch (error) {
        console.error(`Failed to apply template ${templateId} to project ${project.id}:`, error);
        throw error; // Let the transaction rollback
      }
    }

    // 2.5. Seed compliance checklist based on category
    const category = project.project_category || projectData.project_category || 'residential';
    let complianceItems = [];
    if (category === 'commercial') {
      complianceItems = [
        'Fire NOC Approval',
        'Occupancy Permit',
        'Liquidated Damages (LD) Review',
        'Stakeholder Signoff Protocol',
        'Retention Money Clause Verification'
      ];
    } else if (category === 'hospitality') {
      complianceItems = [
        'Fire Safety Certification',
        'Occupancy Permit',
        'Pollution Control Board NOC',
        'Health & Safety Clearances'
      ];
    } else {
      complianceItems = [
        'Client Design Signoff',
        'Society NOC',
        'Material Inward Clearance'
      ];
    }

    for (const item of complianceItems) {
      await client.query(
        `INSERT INTO project_compliance_checklists (tenant_id, project_id, item_name, status)
         VALUES ($1, $2, $3, 'pending')
         ON CONFLICT (project_id, item_name) DO NOTHING`,
        [tenantId, project.id, item]
      );
    }

    // 2.6. Seed MEP coordination checklist items
    const mepItems = [
      'Electrical switch and socket layout marking verification',
      'False ceiling lighting and electrical points alignment coordination',
      'Plumbing routing slopes and structural beam clearance verification',
      'MEP contractors & site team design clash resolution review',
      'Client formal sign-off on layout point adjustments',
      'Contractor drawing clearance before civil execution starts'
    ];

    for (const item of mepItems) {
      await client.query(
        `INSERT INTO project_mep_checklists (tenant_id, project_id, item_name, status)
         VALUES ($1, $2, $3, 'pending')
         ON CONFLICT (project_id, item_name) DO NOTHING`,
        [tenantId, project.id, item]
      );
    }

    await client.query('COMMIT');

    // 3. Log the action (after commit)
    await logAction({
      tenantId,
      userId,
      action: 'project.created',
      entity: 'project',
      entityId: project.id,
      newValue: { name: project.name, client_name: project.client_name }
    });

    // 4. Trigger automation engine
    await enqueueAutomation({
      tenantId,
      eventType: 'record.created',
      entity: 'project',
      record: project
    });

    return project;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { createProject };
