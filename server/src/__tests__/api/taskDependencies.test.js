const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

jest.setTimeout(60000);

describe('Task Dependencies API and sequence enforcement', () => {
  let accessToken;
  let tenantId;
  let projectId;
  let _userId;
  let taskIdA;
  let taskIdB;

  beforeAll(async () => {
    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    const userRes = await pool.query("SELECT id FROM users WHERE email = 'admin@demo.com'");
    userId = userRes.rows[0].id;

    // Create test project
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Dependency Test Project',
        client_name: 'Dep Client',
        client_phone: '9876543210',
        client_email: 'dep@test.com',
        contract_file_key: 'test_key',
        contract_file_name: 'contract.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf'
      });
    projectId = projRes.body.data.id;

    // Create Task A
    const taskARes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Task A (Prerequisite)'
      });
    taskIdA = taskARes.body.data.id;

    // Create Task B
    const taskBRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Task B (Dependent)'
      });
    taskIdB = taskBRes.body.data.id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM projects WHERE id = $1 AND tenant_id = $2', [projectId, tenantId]);
    }
    await pool.end();
  });

  describe('Dependency CRUD and Cycle Detection', () => {
    let depId;

    it('should create a dependency between Task B and Task A', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/task-dependencies`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          taskId: taskIdB,
          dependsOnTaskId: taskIdA,
          dependencyType: 'finish-to-start'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.task_id).toBe(taskIdB);
      expect(res.body.data.depends_on_task_id).toBe(taskIdA);
      depId = res.body.data.id;
    });

    it('should reject a circular dependency (Task A depending on Task B)', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/task-dependencies`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          taskId: taskIdA,
          dependsOnTaskId: taskIdB,
          dependencyType: 'finish-to-start'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CIRCULAR_DEPENDENCY');
    });

    it('should return all dependencies for a project', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/task-dependencies`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(depId);
      expect(res.body.data[0].depends_on_task_title).toBe('Task A (Prerequisite)');
    });

    it('should delete a dependency', async () => {
      const deleteRes = await request(app)
        .delete(`/api/projects/${projectId}/task-dependencies/${depId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(deleteRes.status).toBe(204);

      // Verify it is gone
      const getRes = await request(app)
        .get(`/api/projects/${projectId}/task-dependencies`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(getRes.body.data.length).toBe(0);
    });
  });

  describe('Out-of-Sequence Task Validation', () => {
    beforeEach(async () => {
      // Clean status and dependencies
      await pool.query('DELETE FROM task_dependencies WHERE project_id = $1', [projectId]);
      await pool.query("UPDATE tasks SET status = 'todo' WHERE project_id = $1", [projectId]);
      await pool.query('UPDATE projects SET enforce_dependencies = TRUE WHERE id = $1', [projectId]);
    });

    it('should block starting Task B if Task A is not complete (Finish-to-Start)', async () => {
      // Add B depends on A (FS)
      await request(app)
        .post(`/api/projects/${projectId}/task-dependencies`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          taskId: taskIdB,
          dependsOnTaskId: taskIdA,
          dependencyType: 'finish-to-start'
        });

      // Try starting Task B
      const updateRes = await request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskIdB}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'in_progress' });

      expect(updateRes.status).toBe(400);
      expect(updateRes.body.success).toBe(false);
      expect(updateRes.body.error.code).toBe('DEPENDENCY_UNSATISFIED');
      expect(updateRes.body.error.message).toContain('must be completed first');
    });

    it('should allow starting Task B if enforce_dependencies is false', async () => {
      // Add B depends on A (FS)
      await request(app)
        .post(`/api/projects/${projectId}/task-dependencies`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          taskId: taskIdB,
          dependsOnTaskId: taskIdA,
          dependencyType: 'finish-to-start'
        });

      // Disable enforcement
      await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ enforce_dependencies: false });

      // Start Task B
      const updateRes = await request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskIdB}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'in_progress' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.status).toBe('in_progress');
    });

    it('should allow starting Task B after Task A is complete', async () => {
      // Add B depends on A (FS)
      await request(app)
        .post(`/api/projects/${projectId}/task-dependencies`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          taskId: taskIdB,
          dependsOnTaskId: taskIdA,
          dependencyType: 'finish-to-start'
        });

      // Complete Task A
      const completeARes = await request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskIdA}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'done' });
      expect(completeARes.status).toBe(200);

      // Start Task B
      const updateRes = await request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskIdB}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'in_progress' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.status).toBe('in_progress');
    });

    it('should block starting Task B if Task A is not started (Start-to-Start)', async () => {
      // Add B depends on A (SS)
      await request(app)
        .post(`/api/projects/${projectId}/task-dependencies`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          taskId: taskIdB,
          dependsOnTaskId: taskIdA,
          dependencyType: 'start-to-start'
        });

      // Try starting Task B
      const updateRes = await request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskIdB}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'in_progress' });

      expect(updateRes.status).toBe(400);
      expect(updateRes.body.error.code).toBe('DEPENDENCY_UNSATISFIED');
      expect(updateRes.body.error.message).toContain('must be started first');
    });

    it('should allow starting Task B if Task A is in_progress (Start-to-Start)', async () => {
      // Add B depends on A (SS)
      await request(app)
        .post(`/api/projects/${projectId}/task-dependencies`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          taskId: taskIdB,
          dependsOnTaskId: taskIdA,
          dependencyType: 'start-to-start'
        });

      // Start Task A
      await request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskIdA}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'in_progress' });

      // Start Task B
      const updateRes = await request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskIdB}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'in_progress' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.status).toBe('in_progress');
    });
  });
});
