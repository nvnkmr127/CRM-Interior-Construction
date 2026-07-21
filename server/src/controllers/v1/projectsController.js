const projectRepository = require('../../repositories/projectRepository');
const { success, fail, getQueryParams } = require('../../utils/v1Response');

/**
 * @swagger
 * tags:
 *   name: Projects
 *   description: API for managing Projects
 */

/**
 * @swagger
 * /api/v1/projects:
 *   get:
 *     summary: Retrieve a list of projects
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A list of projects
 */
exports.listProjects = async (req, res) => {
  try {
    const { tenantId } = req;
    const { page, limit, search } = getQueryParams(req);
    
    const filters = { page, limit, search };
    if (req.query.status) filters.status = req.query.status;

    const result = await projectRepository.findProjects(tenantId, filters);
    return success(res, result);
  } catch (error) {
    console.error('List Projects Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   get:
 *     summary: Get a single project by ID
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A single project
 */
exports.getProject = async (req, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    const project = await projectRepository.findProjectById(tenantId, id);
    if (!project) return fail(res, 'Project not found', [], 404);
    return success(res, project);
  } catch (error) {
    console.error('Get Project Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

/**
 * @swagger
 * /api/v1/projects:
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               lead_id:
 *                 type: string
 *     responses:
 *       201:
 *         description: Project created
 */
exports.createProject = async (req, res) => {
  try {
    const { tenantId } = req;
    const data = req.body;
    if (!data.name || !data.lead_id) return fail(res, 'Name and lead_id are required', [], 400);

    const project = await projectRepository.createProject(tenantId, data);
    return success(res, project, 201);
  } catch (error) {
    console.error('Create Project Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   put:
 *     summary: Update an existing project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Project updated
 */
exports.updateProject = async (req, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    const data = req.body;
    const project = await projectRepository.updateProject(tenantId, id, data);
    if (!project) return fail(res, 'Project not found', [], 404);
    return success(res, project);
  } catch (error) {
    console.error('Update Project Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

/**
 * @swagger
 * /api/v1/projects/{id}:
 *   delete:
 *     summary: Delete a project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project deleted
 */
exports.deleteProject = async (req, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    await projectRepository.softDeleteProject(tenantId, id);
    return success(res, { deletedId: id });
  } catch (error) {
    console.error('Delete Project Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};
