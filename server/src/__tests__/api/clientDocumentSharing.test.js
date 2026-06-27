process.env.STORAGE_PROVIDER = 'local';
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');
const crypto = require('crypto');

jest.setTimeout(60000);

describe('Client Document Sharing & Visibility API', () => {
  let accessToken;
  let tenantId;
  let projectId;
  let clientToken;
  let documentId;

  beforeAll(async () => {
    // 1. Log in as staff
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Create test project
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Sharing Test Project',
        client_name: 'Sharing Client',
        client_phone: '9876543211',
        client_email: 'sharing@test.com',
        contract_file_key: 'test_key_sharing',
        contract_file_name: 'contract.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf'
      });
    projectId = projRes.body.data.id;

    // 3. Create a client portal user
    clientToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(clientToken).digest('hex');

    await pool.query(
      `INSERT INTO client_portal_users (tenant_id, project_id, name, phone, portal_token_hash, portal_token_expires_at)
       VALUES ($1, $2, 'Sharing Client', '9876543211', $3, NOW() + INTERVAL '1 day')`,
      [tenantId, projectId, tokenHash]
    );

    // 4. Create a document as staff
    const docRes = await pool.query(
      `INSERT INTO documents (tenant_id, project_id, name, doc_type, version, storage_key, file_size_bytes, mime_type, is_visible_to_client)
       VALUES ($1, $2, 'Layout Plan', 'drawing', 1, 'mock-key-layout.pdf', 2048, 'application/pdf', false)
       RETURNING id`,
      [tenantId, projectId]
    );
    documentId = docRes.rows[0].id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM client_portal_users WHERE project_id = $1 AND tenant_id = $2', [projectId, tenantId]);
      await pool.query('DELETE FROM design_item_comments WHERE document_id IN (SELECT id FROM documents WHERE project_id = $1 AND tenant_id = $2)', [projectId, tenantId]);
      await pool.query('DELETE FROM documents WHERE project_id = $1 AND tenant_id = $2', [projectId, tenantId]);
      await pool.query('DELETE FROM projects WHERE id = $1 AND tenant_id = $2', [projectId, tenantId]);
    }
    await pool.end();
  });

  it('should prevent portal client from seeing the document when is_visible_to_client is false', async () => {
    const res = await request(app)
      .get('/api/portal/project/documents')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const doc = res.body.data.find(d => d.id === documentId);
    expect(doc).toBeUndefined();
  });

  it('should allow staff to toggle is_visible_to_client to true', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}/documents/${documentId}/visibility`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ isVisibleToClient: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.is_visible_to_client).toBe(true);
  });

  it('should allow portal client to see the document when is_visible_to_client is true', async () => {
    const res = await request(app)
      .get('/api/portal/project/documents')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const doc = res.body.data.find(d => d.id === documentId);
    expect(doc).toBeDefined();
    expect(doc.name).toBe('Layout Plan');
    expect(doc.clientAcknowledgedAt).toBeNull();
  });

  it('should allow portal client to comment on the document', async () => {
    const res = await request(app)
      .post(`/api/portal/project/documents/${documentId}/comments`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ comment: 'Please increase bedroom space.' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.comment).toBe('Please increase bedroom space.');
    expect(res.body.data.created_by_client).toBe(true);
    expect(res.body.data.created_by_name).toBe('Sharing Client');
  });

  it('should allow staff to view client comments and post a reply', async () => {
    // 1. Fetch comments as staff
    const getRes = await request(app)
      .get(`/api/projects/${projectId}/documents/${documentId}/comments`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.data.length).toBe(1);
    expect(getRes.body.data[0].comment).toBe('Please increase bedroom space.');

    // 2. Post reply comment as staff
    const postRes = await request(app)
      .post(`/api/projects/${projectId}/documents/${documentId}/comments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ comment: 'Will review and revise.' });

    expect(postRes.status).toBe(201);
    expect(postRes.body.success).toBe(true);
    expect(postRes.body.data.comment).toBe('Will review and revise.');
    expect(postRes.body.data.created_by_client).toBe(false);
  });

  it('should allow portal client to acknowledge document receipt', async () => {
    const res = await request(app)
      .post(`/api/portal/project/documents/${documentId}/acknowledge`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.client_acknowledged_at).not.toBeNull();
    expect(res.body.data.client_acknowledged_by).toBe('Sharing Client');
  });

  it('should verify document shows acknowledged state to staff and portal clients', async () => {
    // 1. Check as portal client
    const portalRes = await request(app)
      .get('/api/portal/project/documents')
      .set('Authorization', `Bearer ${clientToken}`);

    const clientDoc = portalRes.body.data.find(d => d.id === documentId);
    expect(clientDoc.clientAcknowledgedAt).not.toBeNull();
    expect(clientDoc.clientAcknowledgedBy).toBe('Sharing Client');

    // 2. Check as staff
    const staffRes = await request(app)
      .get(`/api/projects/${projectId}/documents`)
      .set('Authorization', `Bearer ${accessToken}`);

    const staffDoc = staffRes.body.data.find(d => d.id === documentId);
    expect(staffDoc.client_acknowledged_at).not.toBeNull();
    expect(staffDoc.client_acknowledged_by).toBe('Sharing Client');
  });
});
