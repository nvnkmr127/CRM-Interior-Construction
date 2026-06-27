const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Project Design Requirements API & Cloning', () => {
  jest.setTimeout(30000);
  let accessToken;
  let tenantId;
  let leadId;
  let projectId;

  beforeAll(async () => {
    // 1. Login to get access token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    // Fetch tenant ID for DB setup
    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Create a lead to test lead-to-project conversion and preferences/requirements cloning
    const phone = `99${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
    const leadRes = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Design Test Lead', phone, source: 'Referral' });
    leadId = leadRes.body.data.id;

    // Update preferences for the lead directly in DB (since a blank row is seeded automatically on lead creation)
    await pool.query(`
      UPDATE lead_preferences 
      SET interior_style = 'Japandi', color_theme = 'Sage & Cream', material = 'Teak & Cane', 
          kitchen_style = 'Island', wardrobe_style = 'Sliding Door', lighting = 'Warm Cove', flooring = 'Wooden'
      WHERE lead_id = $1 AND tenant_id = $2
    `, [leadId, tenantId]);

    // Insert a room requirement for the lead directly into DB
    await pool.query(`
      INSERT INTO lead_requirements (tenant_id, lead_id, room, work_type, priority, estimated_budget, remarks)
      VALUES ($1, $2, 'Master Bedroom', 'Woodwork & Painting', 'High', 250000, 'Maximize wardrobe space')
    `, [tenantId, leadId]);

    // Insert an inspiration for the lead directly into DB
    await pool.query(`
      INSERT INTO lead_inspirations (tenant_id, lead_id, image_url, room_type, notes)
      VALUES ($1, $2, 'https://example.com/moodboard.jpg', 'Master Bedroom', 'Loves this bed frame design')
    `, [tenantId, leadId]);
  });

  afterAll(async () => {
    // Clean up test data
    if (projectId) {
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    if (leadId) {
      await pool.query('DELETE FROM leads WHERE id = $1', [leadId]);
    }
    await pool.query("UPDATE tenants SET config = '{}' WHERE slug = 'demo'");
  });

  describe('Lead Conversion with Design Brief Clone', () => {
    it('clones lead preferences, requirements, and inspirations into project tables during conversion', async () => {
      // Temporarily bypass dynamic checklist requirements in tenant settings
      await pool.query("UPDATE tenants SET config = '{\"pre_conversion_checklist\": []}' WHERE slug = 'demo'");

      const convertRes = await request(app)
        .post(`/api/leads/${leadId}/convert-to-project`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          projectName: 'Design Cloned Project',
          projectType: 'full_interior',
          contract_file_key: 'demo-tenant/contract/signed-agreement.pdf',
          contract_file_name: 'signed-agreement.pdf',
          contract_file_size: 204857,
          contract_file_mime: 'application/pdf'
        });

      expect(convertRes.status).toBe(201);
      expect(convertRes.body.success).toBe(true);
      projectId = convertRes.body.data.project_id;
      expect(projectId).toBeDefined();

      // Retrieve design requirements
      const getRes = await request(app)
        .get(`/api/projects/${projectId}/design-requirements`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);

      const { designRequirements, roomRequirements, inspirations } = getRes.body.data;

      // 1. Verify preferences cloned
      expect(designRequirements).toBeDefined();
      expect(designRequirements.interior_style).toBe('Japandi');
      expect(designRequirements.color_theme).toBe('Sage & Cream');
      expect(designRequirements.material_preference).toBe('Teak & Cane');
      expect(designRequirements.kitchen_style).toBe('Island');
      expect(designRequirements.wardrobe_style).toBe('Sliding Door');
      expect(designRequirements.lighting_preference).toBe('Warm Cove');
      expect(designRequirements.flooring_preference).toBe('Wooden');

      // 2. Verify room requirement cloned
      expect(roomRequirements).toHaveLength(1);
      expect(roomRequirements[0].room_name).toBe('Master Bedroom');
      expect(Number(roomRequirements[0].budget_allocation)).toBe(250000);
      expect(roomRequirements[0].priority).toBe('High');
      expect(roomRequirements[0].functional_requirements).toBe('Woodwork & Painting');
      expect(roomRequirements[0].remarks).toBe('Maximize wardrobe space');

      // 3. Verify inspirations cloned
      expect(inspirations).toHaveLength(1);
      expect(inspirations[0].image_url).toBe('https://example.com/moodboard.jpg');
      expect(inspirations[0].room_type).toBe('Master Bedroom');
      expect(inspirations[0].notes).toBe('Loves this bed frame design');
    });
  });

  describe('Design Requirements CRUD API', () => {
    it('updates general style preferences', async () => {
      const updateRes = await request(app)
        .put(`/api/projects/${projectId}/design-requirements`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          interior_style: 'Minimalist',
          color_theme: 'Monochrome',
          material_preference: 'Concrete and Metal',
          kitchen_style: 'Straight',
          wardrobe_style: 'Hinged Door',
          lighting_preference: 'Accent LED coves',
          flooring_preference: 'Polished Concrete',
          lifestyle_inputs: 'Single resident, working from home',
          must_haves: 'Quiet home office',
          nice_to_haves: 'Smart lights'
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.interior_style).toBe('Minimalist');
      expect(updateRes.body.data.lifestyle_inputs).toBe('Single resident, working from home');
    });

    it('manages room requirements (Add, Update, Delete)', async () => {
      // 1. Create room requirement
      const addRes = await request(app)
        .post(`/api/projects/${projectId}/room-requirements`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          room_name: 'Living Room',
          budget_allocation: 150000,
          priority: 'High',
          functional_requirements: 'Large 6-seater sofa, TV entertainment console',
          remarks: 'Needs modern ceiling profile'
        });

      expect(addRes.status).toBe(201);
      expect(addRes.body.success).toBe(true);
      const roomId = addRes.body.data.id;

      // 2. Update room requirement
      const updateRes = await request(app)
        .put(`/api/projects/${projectId}/room-requirements/${roomId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          room_name: 'Main Living Room',
          budget_allocation: 180000,
          priority: 'Must-have',
          functional_requirements: 'Large 6-seater sofa, TV console, bookshelf',
          remarks: 'Needs warm cove lighting'
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.room_name).toBe('Main Living Room');
      expect(Number(updateRes.body.data.budget_allocation)).toBe(180000);

      // 3. Delete room requirement
      const deleteRes = await request(app)
        .delete(`/api/projects/${projectId}/room-requirements/${roomId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(deleteRes.status).toBe(204);
    });

    it('manages project inspirations (Add, Delete)', async () => {
      // 1. Add inspiration
      const addRes = await request(app)
        .post(`/api/projects/${projectId}/inspirations`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          image_url: 'https://example.com/modern-kitchen.jpg',
          room_type: 'Kitchen',
          notes: 'Client loves the marble backsplash'
        });

      expect(addRes.status).toBe(201);
      expect(addRes.body.success).toBe(true);
      const inspId = addRes.body.data.id;

      // 2. Delete inspiration
      const deleteRes = await request(app)
        .delete(`/api/projects/${projectId}/inspirations/${inspId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(deleteRes.status).toBe(204);
    });
  });
});
