const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Lead-to-Project Conversion Checklist API', () => {
  jest.setTimeout(30000);
  let accessToken;
  let leadId;

  beforeAll(async () => {
    // Reset tenant config to empty before starting tests
    await pool.query("UPDATE tenants SET config = '{}' WHERE slug = 'demo'");

    // Clean database connections and seed if needed
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    // Create a lead to test conversion
    const phone = `98${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
    const leadRes = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Conversion Test Lead', phone, source: 'Website' });
    leadId = leadRes.body.data.id;
  }, 30000);

  afterAll(async () => {
    // Reset tenant config to empty after tests
    await pool.query("UPDATE tenants SET config = '{}' WHERE slug = 'demo'");
  });

  describe('Conversion Gate & Config Integration', () => {
    it('returns 400 validation error if required checklist parameters are missing', async () => {
      // By default, default checklist has: contract_signed, booking_received, scope_finalized, site_visit_completed
      const res = await request(app)
        .post(`/api/leads/${leadId}/convert-to-project`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          projectName: 'Validation Fail Project',
          projectType: 'turnkey',
          booking_received: false,
          scope_finalized: true,
          contract_file_key: 'demo-tenant/contract/signed-agreement.pdf',
          contract_file_name: 'signed-agreement.pdf',
          contract_file_size: 204857,
          contract_file_mime: 'application/pdf'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.missingFields).toContain('contract_signed');
      expect(res.body.error.missingFields).toContain('booking_received');
    });

    it('updates tenant config via PATCH /api/config/tenant-settings', async () => {
      const customChecklist = [
        { key: 'custom_site_verified', label: 'Site Verified', required: true, active: true },
        { key: 'booking_received', label: 'Booking received', required: false, active: true }
      ];

      const res = await request(app)
        .patch('/api/config/tenant-settings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ pre_conversion_checklist: customChecklist });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pre_conversion_checklist).toHaveLength(2);
      expect(res.body.data.pre_conversion_checklist[0].key).toBe('custom_site_verified');
    });

    it('validates conversion based on the customized configuration', async () => {
      // With custom configuration, 'custom_site_verified' is required, 'booking_received' is active but optional
      const res1 = await request(app)
        .post(`/api/leads/${leadId}/convert-to-project`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          projectName: 'Custom Verification Project 1',
          projectType: 'turnkey',
          booking_received: true,
          contract_file_key: 'demo-tenant/contract/signed-agreement.pdf',
          contract_file_name: 'signed-agreement.pdf',
          contract_file_size: 204857,
          contract_file_mime: 'application/pdf'
        });

      expect(res1.status).toBe(400);
      expect(res1.body.error.missingFields).toContain('custom_site_verified');
      expect(res1.body.error.missingFields).not.toContain('booking_received');

      // Now pass the custom verified field
      const res2 = await request(app)
        .post(`/api/leads/${leadId}/convert-to-project`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          projectName: 'Successful Conversion Project',
          projectType: 'turnkey',
          custom_site_verified: true,
          booking_received: false, // optional!
          contract_file_key: 'demo-tenant/contract/signed-agreement.pdf',
          contract_file_name: 'signed-agreement.pdf',
          contract_file_size: 204857,
          contract_file_mime: 'application/pdf',
          agreement_signed_by: 'Lead Signer',
          agreement_signed_at: '2026-06-25T00:00:00.000Z',
          agreement_signature_method: 'physical'
        });

      expect(res2.status).toBe(201);
      expect(res2.body.success).toBe(true);
      const convertedProjectId = res2.body.data.project_id;
      expect(convertedProjectId).toBeTruthy();

      const projDb = await pool.query(
        "SELECT agreement_signed_by, agreement_signature_method FROM projects WHERE id = $1",
        [convertedProjectId]
      );
      expect(projDb.rows[0].agreement_signed_by).toBe('Lead Signer');
      expect(projDb.rows[0].agreement_signature_method).toBe('physical');
    });
  });

  describe('Booking Amount & Activation Gate', () => {
    let projectId;
    let _paymentMilestoneId;

    it('creates a project with booking_amount > 0 and verifies status is pending_booking and Booking Advance milestone is created', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          client_name: 'Jane Doe',
          name: 'Booking Gate Test Project',
          project_type: 'turnkey',
          booking_amount: 15000,
          contract_value: 50000,
          client_phone: '9999999999',
          client_email: 'jane@example.com',
          contract_file_key: 'demo-tenant/contract/signed-agreement.pdf',
          contract_file_name: 'signed-agreement.pdf',
          contract_file_size: 204857,
          contract_file_mime: 'application/pdf'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      projectId = res.body.data.id;
      expect(res.body.data.status).toBe('pending_booking');
      expect(Number(res.body.data.booking_amount)).toBe(15000);

      // Verify the payment milestone "Booking Advance" is created
      const milestonesRes = await request(app)
        .get(`/api/projects/${projectId}/payment-milestones`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(milestonesRes.status).toBe(200);
      expect(milestonesRes.body.success).toBe(true);
      const advanceMilestone = milestonesRes.body.data.find(m => m.name === 'Booking Advance');
      expect(advanceMilestone).toBeDefined();
      expect(parseFloat(advanceMilestone.amount)).toBe(15000);
      expect(advanceMilestone.status).toBe('scheduled');
      paymentMilestoneId = advanceMilestone.id;
    }, 15000);

    it('blocks manual activation of the project when Booking record is missing', async () => {
      const res = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'active' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BOOKING_REQUIRED');
    }, 15000);

    it('automatically activates the project when the booking is confirmed', async () => {
      const usersRes = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${accessToken}`);
      const designerId = usersRes.body.data[0].id;

      const res = await request(app)
        .post(`/api/projects/${projectId}/booking`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          advance_amount: 15000,
          payment_method: 'bank_transfer',
          agreed_scope_summary: 'Full apartment interior package as per specs.',
          design_freeze_target_date: '2026-08-30',
          project_start_date: '2026-07-15',
          assigned_designer_id: designerId,
          agreement_file_key: 'demo-tenant/contract/signed-agreement.pdf',
          agreement_file_name: 'signed-agreement.pdf',
          agreement_file_size: 204857,
          agreement_file_mime: 'application/pdf'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Fetch project to verify it's now active
      const projectRes = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(projectRes.status).toBe(200);
      expect(projectRes.body.success).toBe(true);
      expect(projectRes.body.data.status).toBe('active');
    }, 15000);
  });

  describe('Contract Document Attachment Gate', () => {
    it('fails to convert lead to project if contract document details are missing', async () => {
      // Create a fresh unconverted lead for this test case
      const phone = `98${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
      const leadRes = await request(app)
        .post('/api/leads')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Fresh Conversion Test Lead', phone, source: 'Website' });
      const freshLeadId = leadRes.body.data.id;

      const res = await request(app)
        .post(`/api/leads/${freshLeadId}/convert-to-project`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          projectName: 'No Contract Project',
          projectType: 'turnkey',
          custom_site_verified: true,
          booking_received: true
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.missingFields).toContain('contract_file_key');
    }, 15000);

    it('fails to create project directly if contract document details are missing', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          client_name: 'Jane Doe',
          name: 'No Contract Direct Project',
          project_type: 'turnkey',
          contract_value: 50000,
          client_phone: '9999999999',
          client_email: 'jane@example.com'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }, 15000);

    it('successfully creates project and registers contract document when valid details are provided', async () => {
      const uniqueName = `Contract Test Project ${Date.now()}`;
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          client_name: 'John Contract',
          name: uniqueName,
          project_type: 'turnkey',
          contract_value: 60000,
          client_phone: '9888888888',
          client_email: 'john.c@example.com',
          contract_file_key: 'demo-tenant/contract/john-agreement.pdf',
          contract_file_name: 'john-agreement.pdf',
          contract_file_size: 154320,
          contract_file_mime: 'application/pdf',
          agreement_signed_by: 'Test Signer',
          agreement_signed_at: '2026-06-25T00:00:00.000Z',
          agreement_signature_method: 'digital'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const projectId = res.body.data.id;

      const docRes = await pool.query(
        "SELECT * FROM documents WHERE project_id = $1 AND doc_type = 'contract'",
        [projectId]
      );
      expect(docRes.rows.length).toBe(1);
      expect(docRes.rows[0].name).toBe('john-agreement.pdf');
      expect(docRes.rows[0].version).toBe(1);
      expect(docRes.rows[0].status).toBe('approved');

      const projDbRes = await pool.query(
        "SELECT agreement_signed_by, agreement_signature_method FROM projects WHERE id = $1",
        [projectId]
      );
      expect(projDbRes.rows[0].agreement_signed_by).toBe('Test Signer');
      expect(projDbRes.rows[0].agreement_signature_method).toBe('digital');
    }, 15000);
  });

  describe('Scope Lock Integration Gate', () => {
    let tenantId;
    let userId;

    beforeAll(async () => {
      const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
      tenantId = tenantRes.rows[0].id;
      const userRes = await pool.query("SELECT id FROM users WHERE email = 'admin@demo.com'");
      userId = userRes.rows[0].id;
    });

    it('blocks starting an execution phase manually via PUT route if scope is not locked or no approved contract document', async () => {
      // 1. Create a project
      const projRes = await pool.query(`
        INSERT INTO projects (tenant_id, name, client_name, status, is_scope_locked, created_by)
        VALUES ($1, 'Scope Lock Test Proj 1', 'Client 1', 'active', false, $2)
        RETURNING id
      `, [tenantId, userId]);
      const projectId = projRes.rows[0].id;

      // Seed commercial approval so checklist check passes
      await pool.query(
        "INSERT INTO project_commercial_approvals (tenant_id, project_id) VALUES ($1, $2)",
        [tenantId, projectId]
      );

      // 2. Create an execution phase (is_execution = true)
      const phaseRes = await pool.query(`
        INSERT INTO project_phases (tenant_id, project_id, name, sort_order, status, is_execution)
        VALUES ($1, $2, 'Procurement Phase', 1, 'pending', true)
        RETURNING id
      `, [tenantId, projectId]);
      const phaseId = phaseRes.rows[0].id;

      // 3. Try to transition to in_progress manually
      const res = await request(app)
        .put(`/api/projects/${projectId}/phases/${phaseId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'in_progress' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SCOPE_LOCK_REQUIRED');
    }, 15000);

    it('blocks auto-starting the next execution phase on sign-off of design phase if scope is not locked', async () => {
      // 1. Create project
      const projRes = await pool.query(`
        INSERT INTO projects (tenant_id, name, client_name, status, is_scope_locked, created_by)
        VALUES ($1, 'Scope Lock Test Proj 2', 'Client 2', 'active', false, $2)
        RETURNING id
      `, [tenantId, userId]);
      const projectId = projRes.rows[0].id;

      // Seed commercial approval so checklist check passes
      await pool.query(
        "INSERT INTO project_commercial_approvals (tenant_id, project_id) VALUES ($1, $2)",
        [tenantId, projectId]
      );

      // 2. Create Design Phase (is_execution = false, status = 'in_progress')
      const phase1Res = await pool.query(`
        INSERT INTO project_phases (tenant_id, project_id, name, sort_order, status, is_execution)
        VALUES ($1, $2, 'Design Phase', 1, 'in_progress', false)
        RETURNING id
      `, [tenantId, projectId]);
      const phase1Id = phase1Res.rows[0].id;

      // 3. Create Execution Phase (is_execution = true, status = 'pending')
      const phase2Res = await pool.query(`
        INSERT INTO project_phases (tenant_id, project_id, name, sort_order, status, is_execution)
        VALUES ($1, $2, 'Execution Phase', 2, 'pending', true)
        RETURNING id
      `, [tenantId, projectId]);
      const _phase2Id = phase2Res.rows[0].id;

      // 4. Sign off the first phase. It should throw SCOPE_LOCK_REQUIRED because it tries to auto-start next execution phase
      const res = await request(app)
        .post(`/api/projects/${projectId}/phases/${phase1Id}/sign-off`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SCOPE_LOCK_REQUIRED');
    }, 15000);

    it('allows starting execution phase once scope is locked and approved contract document exists', async () => {
      // 1. Create project with is_scope_locked = true
      const projRes = await pool.query(`
        INSERT INTO projects (tenant_id, name, client_name, status, is_scope_locked, created_by)
        VALUES ($1, 'Scope Lock Test Proj 3', 'Client 3', 'active', true, $2)
        RETURNING id
      `, [tenantId, userId]);
      const projectId = projRes.rows[0].id;

      // Seed commercial approval so checklist check passes
      await pool.query(
        "INSERT INTO project_commercial_approvals (tenant_id, project_id) VALUES ($1, $2)",
        [tenantId, projectId]
      );

      // 2. Insert approved contract document
      await pool.query(`
        INSERT INTO documents (tenant_id, project_id, name, doc_type, version, storage_key, status, uploaded_by)
        VALUES ($1, $2, 'contract.pdf', 'contract', 1, 'key-pdf', 'approved', $3)
      `, [tenantId, projectId, userId]);

      // 2.5 Seed completed site readiness checklist items
      await pool.query(`
        INSERT INTO project_site_readiness (tenant_id, project_id, item_key, label, is_completed)
        VALUES 
          ($1, $2, 'civil_handover', 'Civil Handover Completed', true),
          ($1, $2, 'electrical_rough_in', 'Electrical Rough-In Ready', true),
          ($1, $2, 'waterproofing', 'Wet Area Waterproofing Done', true),
          ($1, $2, 'debris_cleared', 'Debris Cleared & Site Cleaned', true)
      `, [tenantId, projectId]);

      // 3. Create execution phase
      const phaseRes = await pool.query(`
        INSERT INTO project_phases (tenant_id, project_id, name, sort_order, status, is_execution)
        VALUES ($1, $2, 'Execution Phase', 1, 'pending', true)
        RETURNING id
      `, [tenantId, projectId]);
      const phaseId = phaseRes.rows[0].id;

      // 4. Try to start manually
      const res = await request(app)
        .put(`/api/projects/${projectId}/phases/${phaseId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'in_progress' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('in_progress');
    }, 15000);
  });

  describe('Payment Terms & Auto-Milestone Generation', () => {
    it('creates a project with payment terms 10_40_40_10 and verifies 4 payment milestones are generated and booking_amount is in sync', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          client_name: 'John Terms',
          name: 'Payment Terms Test Project',
          project_type: 'turnkey',
          contract_value: 100000,
          payment_terms: '10_40_40_10',
          client_phone: '9999999999',
          client_email: 'john.terms@example.com',
          contract_file_key: 'demo-tenant/contract/signed-agreement.pdf',
          contract_file_name: 'signed-agreement.pdf',
          contract_file_size: 204857,
          contract_file_mime: 'application/pdf',
          agreement_signed_by: 'John Terms',
          agreement_signed_at: '2026-06-25T00:00:00.000Z',
          agreement_signature_method: 'digital'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const projectId = res.body.data.id;
      expect(res.body.data.status).toBe('pending_booking');
      expect(Number(res.body.data.booking_amount)).toBe(10000); // 10% of 100,000

      // Fetch payment milestones
      const milestonesRes = await request(app)
        .get(`/api/projects/${projectId}/payment-milestones`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(milestonesRes.status).toBe(200);
      expect(milestonesRes.body.success).toBe(true);
      const milestones = milestonesRes.body.data;
      expect(milestones).toHaveLength(4);

      // Verify amounts and percentages
      const bookingAdvance = milestones.find(m => m.name === 'Booking Advance');
      expect(bookingAdvance).toBeDefined();
      expect(parseFloat(bookingAdvance.amount)).toBe(10000);
      expect(Number(bookingAdvance.percentage)).toBe(10);

      const designSignoff = milestones.find(m => m.name === 'Design Sign-off');
      expect(designSignoff).toBeDefined();
      expect(parseFloat(designSignoff.amount)).toBe(40000);
      expect(Number(designSignoff.percentage)).toBe(40);

      const production = milestones.find(m => m.name === 'Production Commencement');
      expect(production).toBeDefined();
      expect(parseFloat(production.amount)).toBe(40000);
      expect(Number(production.percentage)).toBe(40);

      const handover = milestones.find(m => m.name === 'Handover');
      expect(handover).toBeDefined();
      expect(parseFloat(handover.amount)).toBe(10000);
      expect(Number(handover.percentage)).toBe(10);
    }, 15000);
  });
});
