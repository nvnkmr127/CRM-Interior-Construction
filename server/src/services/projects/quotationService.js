const pool = require('../../db/pool');

class QuotationService {
  async createQuotation(tenantId, data) {
    const { leadId, projectId, createdBy, quotationNumber, notes, termsConditions, validUntil } = data;
    
    const query = `
      INSERT INTO quotations 
      (tenant_id, lead_id, project_id, created_by, quotation_number, notes, terms_conditions, valid_until)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [tenantId, leadId, projectId, createdBy, quotationNumber, notes, termsConditions, validUntil];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async getQuotationById(tenantId, quotationId) {
    const query = `SELECT * FROM quotations WHERE id = $1 AND tenant_id = $2`;
    const result = await pool.query(query, [quotationId, tenantId]);
    return result.rows[0];
  }

  async addBOQItem(tenantId, quotationId, itemData) {
    const { parentItemId, roomOrArea, itemName, description, unit, quantity, unitPrice, markupPercentage, materialSpecifications, brand, sortOrder } = itemData;

    const query = `
      INSERT INTO quotation_items 
      (tenant_id, quotation_id, parent_item_id, room_or_area, item_name, description, unit, quantity, unit_price, markup_percentage, material_specifications, brand, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    const values = [
      tenantId, quotationId, parentItemId, roomOrArea, itemName, description, 
      unit, quantity, unitPrice, markupPercentage, materialSpecifications, brand, sortOrder
    ];

    const result = await pool.query(query, values);
    await this.updateQuotationTotals(tenantId, quotationId);
    return result.rows[0];
  }

  async updateQuotationTotals(tenantId, quotationId) {
    // Calculate the new total from quotation_items
    const sumQuery = `
      SELECT COALESCE(SUM(total_price), 0) as new_subtotal
      FROM quotation_items
      WHERE quotation_id = $1 AND tenant_id = $2
    `;
    const sumResult = await pool.query(sumQuery, [quotationId, tenantId]);
    const newSubtotal = parseFloat(sumResult.rows[0].new_subtotal);

    // Get current tax/discount to recalculate final total (simplified logic here)
    const updateQuery = `
      UPDATE quotations
      SET subtotal = $1,
          total_amount = $1 + tax_amount - discount_amount,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
    `;
    const updateResult = await pool.query(updateQuery, [newSubtotal, quotationId, tenantId]);
    return updateResult.rows[0];
  }

  async getQuotationWithItems(tenantId, quotationId) {
    const quotation = await this.getQuotationById(tenantId, quotationId);
    if (!quotation) return null;

    const itemsQuery = `
      SELECT * FROM quotation_items 
      WHERE quotation_id = $1 AND tenant_id = $2
      ORDER BY sort_order ASC, created_at ASC
    `;
    const itemsResult = await pool.query(itemsQuery, [quotationId, tenantId]);
    
    quotation.items = itemsResult.rows;
    return quotation;
  }
}

module.exports = new QuotationService();
