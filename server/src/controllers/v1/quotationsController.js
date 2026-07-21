const pool = require('../../db/pool');
const { success, fail, getQueryParams } = require('../../utils/v1Response');

/**
 * @swagger
 * tags:
 *   name: Quotations
 *   description: API for managing Quotations
 */

exports.listQuotations = async (req, res) => {
  try {
    const { tenantId } = req;
    const { page, limit, sortColumn, sortDirection, offset } = getQueryParams(req);
    
    const validSortCols = ['created_at', 'status', 'version'];
    const safeSort = validSortCols.includes(sortColumn) ? sortColumn : 'created_at';

    let query = `SELECT * FROM quotations WHERE tenant_id = $1`;
    let countQuery = `SELECT COUNT(*) FROM quotations WHERE tenant_id = $1`;
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
    console.error('List Quotations Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

exports.getQuotation = async (req, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    const { rows } = await pool.query(`SELECT * FROM quotations WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    if (!rows.length) return fail(res, 'Quotation not found', [], 404);
    return success(res, rows[0]);
  } catch (error) {
    console.error('Get Quotation Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

exports.createQuotation = async (req, res) => {
  try {
    const { tenantId } = req;
    const data = req.body;
    
    if (!data.project_id) return fail(res, 'project_id is required', [], 400);

    const { rows } = await pool.query(
      `INSERT INTO quotations (tenant_id, project_id, status, version)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [tenantId, data.project_id, data.status || 'draft', data.version || 1]
    );
    return success(res, rows[0], 201);
  } catch (error) {
    console.error('Create Quotation Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

exports.updateQuotation = async (req, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    const { status } = req.body;
    
    const { rows } = await pool.query(
      `UPDATE quotations SET status = COALESCE($1, status), updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $2 AND id = $3 RETURNING *`,
      [status, tenantId, id]
    );
    
    if (!rows.length) return fail(res, 'Quotation not found', [], 404);
    return success(res, rows[0]);
  } catch (error) {
    console.error('Update Quotation Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};

exports.deleteQuotation = async (req, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    const { rowCount } = await pool.query(`DELETE FROM quotations WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    if (rowCount === 0) return fail(res, 'Quotation not found', [], 404);
    return success(res, { deletedId: id });
  } catch (error) {
    console.error('Delete Quotation Error:', error);
    return fail(res, 'Internal Server Error', [error.message], 500);
  }
};
