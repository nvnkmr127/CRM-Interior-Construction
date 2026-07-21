const leadRepository = require('../../repositories/leadRepository');
const { success, fail, getQueryParams } = require('../../utils/v1Response');

/**
 * @swagger
 * tags:
 *   name: Customers
 *   description: API for managing Customers (Leads with Won status)
 */

exports.listCustomers = async (req, res) => {
  try {
    const { tenantId } = req;
    const { page, limit, sortColumn, sortDirection, search } = getQueryParams(req);
    
    // Customers are leads with status 'won'
    const filters = { status: 'won' };
    if (search) filters.search = search;

    const result = await leadRepository.findLeads(tenantId, filters, page, limit, sortColumn, sortDirection);
    return success(res, result);
  } catch (error) {
    console.error('List Customers Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

exports.getCustomer = async (req, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    const lead = await leadRepository.findLeadById(tenantId, id);
    if (!lead || lead.status !== 'won') return fail(res, 'Customer not found', [], 404);
    return success(res, lead);
  } catch (error) {
    console.error('Get Customer Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

exports.createCustomer = async (req, res) => {
  try {
    const { tenantId } = req;
    const data = { ...req.body, status: 'won' };
    if (!data.name) return fail(res, 'Name is required', [], 400);

    const lead = await leadRepository.createLead(tenantId, data);
    return success(res, lead, 201);
  } catch (error) {
    console.error('Create Customer Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    
    const lead = await leadRepository.findLeadById(tenantId, id);
    if (!lead || lead.status !== 'won') return fail(res, 'Customer not found', [], 404);

    const data = { ...req.body, status: 'won' }; // Ensure they don't change status out of won via this endpoint
    const updated = await leadRepository.updateLead(tenantId, id, data);
    return success(res, updated);
  } catch (error) {
    console.error('Update Customer Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    const lead = await leadRepository.findLeadById(tenantId, id);
    if (!lead || lead.status !== 'won') return fail(res, 'Customer not found', [], 404);

    await leadRepository.softDeleteLead(tenantId, id);
    return success(res, { deletedId: id });
  } catch (error) {
    console.error('Delete Customer Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};
