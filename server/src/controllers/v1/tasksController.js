const taskRepository = require('../../repositories/taskRepository');
const { success, fail, getQueryParams } = require('../../utils/v1Response');

/**
 * @swagger
 * tags:
 *   name: Tasks
 *   description: API for managing Tasks
 */

/**
 * @swagger
 * /api/v1/tasks:
 *   get:
 *     summary: Retrieve a list of tasks
 *     tags: [Tasks]
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
 *         name: projectId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A list of tasks
 */
exports.listTasks = async (req, res) => {
  try {
    const { tenantId } = req;
    const { page, limit } = getQueryParams(req);
    
    const filters = { page, limit, allTasks: true };
    if (req.query.projectId) filters.projectId = req.query.projectId;
    if (req.query.status) filters.status = req.query.status;

    const result = await taskRepository.findTasks(tenantId, filters);
    return success(res, result);
  } catch (error) {
    console.error('List Tasks Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

/**
 * @swagger
 * /api/v1/tasks/{id}:
 *   get:
 *     summary: Get a single task by ID
 *     tags: [Tasks]
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
 *         description: A single task
 */
exports.getTask = async (req, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    const task = await taskRepository.findTaskById(tenantId, id);
    if (!task) return fail(res, 'Task not found', [], 404);
    return success(res, task);
  } catch (error) {
    console.error('Get Task Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

/**
 * @swagger
 * /api/v1/tasks:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               project_id:
 *                 type: string
 *     responses:
 *       201:
 *         description: Task created
 */
exports.createTask = async (req, res) => {
  try {
    const { tenantId } = req;
    const data = req.body;
    if (!data.title) return fail(res, 'Title is required', [], 400);

    const task = await taskRepository.createTask(tenantId, data);
    return success(res, task, 201);
  } catch (error) {
    console.error('Create Task Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

/**
 * @swagger
 * /api/v1/tasks/{id}:
 *   put:
 *     summary: Update an existing task
 *     tags: [Tasks]
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
 *         description: Task updated
 */
exports.updateTask = async (req, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    const data = req.body;
    const task = await taskRepository.updateTask(tenantId, id, data);
    if (!task) return fail(res, 'Task not found', [], 404);
    return success(res, task);
  } catch (error) {
    console.error('Update Task Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

/**
 * @swagger
 * /api/v1/tasks/{id}:
 *   delete:
 *     summary: Delete a task
 *     tags: [Tasks]
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
 *         description: Task deleted
 */
exports.deleteTask = async (req, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    await taskRepository.softDeleteTask(tenantId, id);
    return success(res, { deletedId: id });
  } catch (error) {
    console.error('Delete Task Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};
