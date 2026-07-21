const pool = require('../../db/pool');
const { success, fail, getQueryParams } = require('../../utils/v1Response');

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: API for managing Payments (Invoices)
 */

exports.listPayments = async (req, res) => {
  try {
    const { tenantId } = req;
    const { page, limit, sortColumn, sortDirection, offset } = getQueryParams(req);
    
    // Sort column validation for payments (invoices)
    const validSortCols = ['created_at', 'invoice_date', 'due_date', 'amount', 'status'];
    const safeSort = validSortCols.includes(sortColumn) ? sortColumn : 'created_at';

    let query = `SELECT * FROM invoices WHERE tenant_id = $1`;
    let countQuery = `SELECT COUNT(*) FROM invoices WHERE tenant_id = $1`;
    let values = [tenantId];
    
    if (req.query.projectId) {
      values.push(req.query.projectId);
      query += ` AND project_id = $${values.length}`;
      countQuery += ` AND project_id = $${values.length}`;
    }
    
    query += ` ORDER BY ${safeSort} ${sortDirection} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    
    const countRes = await pool.query(countQuery, values);
    const dataRes = await pool.query(query, [...values, limit, offset]);

    return res.status(200).json({
      success: true,
      data: dataRes.rows,
      meta: {
        total: parseInt(countRes.rows[0].count),
        page,
        limit
      }
    });
  } catch (error) {
    console.error('List Payments Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

exports.getPayment = async (req, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    const { rows } = await pool.query(`SELECT * FROM invoices WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    if (!rows.length) return fail(res, 'Payment not found', [], 404);
    return success(res, rows[0]);
  } catch (error) {
    console.error('Get Payment Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

// Creating/Updating Invoices involves complex PDF generation and milestone linkage in invoiceService.js
// We will provide simplified stubs for v1 or allow basic record creation.
exports.createPayment = async (req, res) => {
  try {
    const { tenantId } = req;
    const data = req.body;
    
    if (!data.project_id || !data.amount) return fail(res, 'project_id and amount are required', [], 400);

    const { rows } = await pool.query(
      `INSERT INTO invoices (tenant_id, project_id, amount, status, invoice_date, due_date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tenantId, data.project_id, data.amount, data.status || 'draft', data.invoice_date || new Date(), data.due_date || new Date()]
    );
    return success(res, rows[0], 201);
  } catch (error) {
    console.error('Create Payment Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

exports.updatePayment = async (req, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    const { status, amount } = req.body;
    
    const { rows } = await pool.query(
      `UPDATE invoices SET status = COALESCE($1, status), amount = COALESCE($2, amount) WHERE tenant_id = $3 AND id = $4 RETURNING *`,
      [status, amount, tenantId, id]
    );
    
    if (!rows.length) return fail(res, 'Payment not found', [], 404);
    return success(res, rows[0]);
  } catch (error) {
    console.error('Update Payment Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

exports.deletePayment = async (req, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    const { rowCount } = await pool.query(`DELETE FROM invoices WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    if (rowCount === 0) return fail(res, 'Payment not found', [], 404);
    return success(res, { deletedId: id });
  } catch (error) {
    console.error('Delete Payment Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};
