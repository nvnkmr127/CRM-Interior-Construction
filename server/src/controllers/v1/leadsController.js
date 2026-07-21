const leadRepository = require('../../repositories/leadRepository');
const { success, fail, getQueryParams } = require('../../utils/v1Response');

/**
 * @swagger
 * tags:
 *   name: Leads
 *   description: API for managing Leads
 */

/**
 * @swagger
 * /api/v1/leads:
 *   get:
 *     summary: Retrieve a list of leads
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email
 *     responses:
 *       200:
 *         description: A list of leads
 *       401:
 *         description: Unauthorized
 */
exports.listLeads = async (req, res) => {
  try {
    const { tenantId } = req;
    const { page, limit, sortColumn, sortDirection, search } = getQueryParams(req);
    
    // Existing findLeads takes (tenantId, filters, page, limit, sortBy, sortOrder)
    const filters = {};
    if (search) filters.search = search;

    const result = await leadRepository.findLeads(tenantId, filters, page, limit, sortColumn, sortDirection);
    return success(res, result);
  } catch (error) {
    console.error('List Leads Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

/**
 * @swagger
 * /api/v1/leads/{id}:
 *   get:
 *     summary: Get a single lead by ID
 *     tags: [Leads]
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
 *         description: A single lead
 *       404:
 *         description: Not Found
 */
exports.getLead = async (req, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    const lead = await leadRepository.findLeadById(tenantId, id);
    if (!lead) return fail(res, 'Lead not found', [], 404);
    return success(res, lead);
  } catch (error) {
    console.error('Get Lead Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

/**
 * @swagger
 * /api/v1/leads:
 *   post:
 *     summary: Create a new lead
 *     tags: [Leads]
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
 *               email:
 *                 type: string
 *     responses:
 *       201:
 *         description: Lead created
 */
exports.createLead = async (req, res) => {
  try {
    const { tenantId } = req;
    const data = req.body;
    if (!data.name) return fail(res, 'Name is required', [], 400);

    const lead = await leadRepository.createLead(tenantId, data);
    return success(res, lead, 201);
  } catch (error) {
    console.error('Create Lead Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

/**
 * @swagger
 * /api/v1/leads/{id}:
 *   put:
 *     summary: Update an existing lead
 *     tags: [Leads]
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
 *         description: Lead updated
 */
exports.updateLead = async (req, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    const data = req.body;
    const lead = await leadRepository.updateLead(tenantId, id, data);
    if (!lead) return fail(res, 'Lead not found', [], 404);
    return success(res, lead);
  } catch (error) {
    console.error('Update Lead Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

/**
 * @swagger
 * /api/v1/leads/{id}:
 *   delete:
 *     summary: Delete a lead
 *     tags: [Leads]
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
 *         description: Lead deleted
 */
exports.deleteLead = async (req, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    await leadRepository.softDeleteLead(tenantId, id);
    return success(res, { deletedId: id });
  } catch (error) {
    console.error('Delete Lead Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};
