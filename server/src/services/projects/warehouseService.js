const pool = require('../../db/pool');

class WarehouseService {
  async listWarehouses(tenantId) {
    const query = `
      SELECT * FROM warehouses 
      WHERE tenant_id = $1 
      ORDER BY name ASC
    `;
    const res = await pool.query(query, [tenantId]);
    return res.rows;
  }

  async createWarehouse(tenantId, data) {
    const { name, location } = data;
    if (!name) throw new Error('Warehouse name is required');

    const query = `
      INSERT INTO warehouses (tenant_id, name, location, status)
      VALUES ($1, $2, $3, 'active')
      RETURNING *
    `;
    const res = await pool.query(query, [tenantId, name, location || null]);
    return res.rows[0];
  }

  async getInventory(tenantId, warehouseId, projectId) {
    let query = `
      SELECT i.*, p.name as project_name
      FROM inventory_items i
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE i.tenant_id = $1 AND i.warehouse_id = $2
    `;
    const params = [tenantId, warehouseId];

    if (projectId) {
      query += ` AND i.project_id = $3`;
      params.push(projectId);
    }

    query += ` ORDER BY i.item_name ASC`;
    const res = await pool.query(query, params);
    return res.rows;
  }

  async getQuarantined(tenantId, warehouseId) {
    const query = `
      SELECT q.*, p.name as project_name
      FROM quarantined_items q
      LEFT JOIN projects p ON q.project_id = p.id
      WHERE q.tenant_id = $1 AND q.warehouse_id = $2
      ORDER BY q.item_name ASC
    `;
    const res = await pool.query(query, [tenantId, warehouseId]);
    return res.rows;
  }

  async getTransactions(tenantId, warehouseId) {
    const query = `
      SELECT t.*, p.name as project_name, u.name as created_by_name
      FROM inventory_transactions t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.tenant_id = $1 AND t.warehouse_id = $2
      ORDER BY t.created_at DESC
    `;
    const res = await pool.query(query, [tenantId, warehouseId]);
    return res.rows;
  }

  async receiveMaterial(tenantId, userId, data) {
    const { warehouseId, itemName, materialSpecifications, brand, quantity, unit, projectId, binLocation, notes } = data;
    if (!warehouseId || !itemName || !quantity || !unit) {
      throw new Error('Missing required fields: warehouseId, itemName, quantity, unit');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert or update active stock
      const stockQuery = `
        INSERT INTO inventory_items 
        (tenant_id, warehouse_id, item_name, material_specifications, brand, quantity, unit, project_id, bin_location)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (tenant_id, warehouse_id, item_name, COALESCE(brand, ''), COALESCE(material_specifications, ''), COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid))
        DO UPDATE SET 
          quantity = inventory_items.quantity + EXCLUDED.quantity,
          bin_location = COALESCE(EXCLUDED.bin_location, inventory_items.bin_location),
          updated_at = NOW()
        RETURNING *
      `;
      const stockRes = await client.query(stockQuery, [
        tenantId,
        warehouseId,
        itemName,
        materialSpecifications || null,
        brand || null,
        Number(quantity),
        unit,
        projectId || null,
        binLocation || null
      ]);

      // 2. Log transaction
      const txQuery = `
        INSERT INTO inventory_transactions 
        (tenant_id, warehouse_id, transaction_type, project_id, item_name, material_specifications, brand, quantity, unit, notes, created_by)
        VALUES ($1, $2, 'receipt', $3, $4, $5, $6, $7, $8, $9, $10)
      `;
      await client.query(txQuery, [
        tenantId,
        warehouseId,
        projectId || null,
        itemName,
        materialSpecifications || null,
        brand || null,
        Number(quantity),
        unit,
        notes || 'Material received at warehouse.',
        userId || null
      ]);

      await client.query('COMMIT');
      return stockRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async dispatchToSite(tenantId, userId, data) {
    const { warehouseId, itemId, projectId, quantity, notes } = data;
    if (!warehouseId || !itemId || !projectId || !quantity) {
      throw new Error('Missing required fields: warehouseId, itemId, projectId, quantity');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get active stock item
      const itemRes = await client.query(
        'SELECT * FROM inventory_items WHERE id = $1 AND warehouse_id = $2 AND tenant_id = $3',
        [itemId, warehouseId, tenantId]
      );
      if (itemRes.rows.length === 0) throw new Error('Inventory item not found');
      const item = itemRes.rows[0];

      if (Number(item.quantity) < Number(quantity)) {
        throw new Error(`Insufficient stock. Available: ${item.quantity} ${item.unit}`);
      }

      // 2. Decrement stock
      const updatedQty = Number(item.quantity) - Number(quantity);
      let updatedItem;

      if (updatedQty <= 0) {
        // We update to 0 so we retain the row/bin mapping or we can delete it. Setting to 0 is cleaner.
        const updateQuery = 'UPDATE inventory_items SET quantity = 0, updated_at = NOW() WHERE id = $1 RETURNING *';
        const res = await client.query(updateQuery, [itemId]);
        updatedItem = res.rows[0];
      } else {
        const updateQuery = 'UPDATE inventory_items SET quantity = $1, updated_at = NOW() WHERE id = $2 RETURNING *';
        const res = await client.query(updateQuery, [updatedQty, itemId]);
        updatedItem = res.rows[0];
      }

      // 3. Log transaction
      const txQuery = `
        INSERT INTO inventory_transactions 
        (tenant_id, warehouse_id, transaction_type, project_id, item_name, material_specifications, brand, quantity, unit, notes, created_by)
        VALUES ($1, $2, 'dispatch_to_site', $3, $4, $5, $6, $7, $8, $9, $10)
      `;
      await client.query(txQuery, [
        tenantId,
        warehouseId,
        projectId,
        item.item_name,
        item.material_specifications || null,
        item.brand || null,
        Number(quantity),
        item.unit,
        notes || 'Dispatched to project site.',
        userId || null
      ]);

      await client.query('COMMIT');
      return updatedItem;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async returnFromSite(tenantId, userId, data) {
    const { warehouseId, projectId, itemName, materialSpecifications, brand, quantity, unit, binLocation, notes } = data;
    if (!warehouseId || !projectId || !itemName || !quantity || !unit) {
      throw new Error('Missing required fields: warehouseId, projectId, itemName, quantity, unit');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Add back to inventory
      const stockQuery = `
        INSERT INTO inventory_items 
        (tenant_id, warehouse_id, item_name, material_specifications, brand, quantity, unit, project_id, bin_location)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (tenant_id, warehouse_id, item_name, COALESCE(brand, ''), COALESCE(material_specifications, ''), COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid))
        DO UPDATE SET 
          quantity = inventory_items.quantity + EXCLUDED.quantity,
          bin_location = COALESCE(EXCLUDED.bin_location, inventory_items.bin_location),
          updated_at = NOW()
        RETURNING *
      `;
      const stockRes = await client.query(stockQuery, [
        tenantId,
        warehouseId,
        itemName,
        materialSpecifications || null,
        brand || null,
        Number(quantity),
        unit,
        projectId,
        binLocation || null
      ]);

      // 2. Log transaction
      const txQuery = `
        INSERT INTO inventory_transactions 
        (tenant_id, warehouse_id, transaction_type, project_id, item_name, material_specifications, brand, quantity, unit, notes, created_by)
        VALUES ($1, $2, 'return_from_site', $3, $4, $5, $6, $7, $8, $9, $10)
      `;
      await client.query(txQuery, [
        tenantId,
        warehouseId,
        projectId,
        itemName,
        materialSpecifications || null,
        brand || null,
        Number(quantity),
        unit,
        notes || 'Returned from site.',
        userId || null
      ]);

      await client.query('COMMIT');
      return stockRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async quarantineMaterial(tenantId, userId, data) {
    const { warehouseId, itemId, quantity, reason, notes } = data;
    if (!warehouseId || !itemId || !quantity || !reason) {
      throw new Error('Missing required fields: warehouseId, itemId, quantity, reason');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get active stock item
      const itemRes = await client.query(
        'SELECT * FROM inventory_items WHERE id = $1 AND warehouse_id = $2 AND tenant_id = $3',
        [itemId, warehouseId, tenantId]
      );
      if (itemRes.rows.length === 0) throw new Error('Inventory item not found');
      const item = itemRes.rows[0];

      if (Number(item.quantity) < Number(quantity)) {
        throw new Error(`Insufficient stock. Available: ${item.quantity} ${item.unit}`);
      }

      // 2. Decrement active stock
      const updatedQty = Number(item.quantity) - Number(quantity);
      await client.query(
        'UPDATE inventory_items SET quantity = $1, updated_at = NOW() WHERE id = $2',
        [updatedQty, itemId]
      );

      // 3. Increment quarantined stock
      const qQuery = `
        INSERT INTO quarantined_items 
        (tenant_id, warehouse_id, item_name, material_specifications, brand, quantity, unit, project_id, reason)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (tenant_id, warehouse_id, item_name, COALESCE(brand, ''), COALESCE(material_specifications, ''), COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(reason, ''))
        DO UPDATE SET 
          quantity = quarantined_items.quantity + EXCLUDED.quantity,
          updated_at = NOW()
        RETURNING *
      `;
      const qRes = await client.query(qQuery, [
        tenantId,
        warehouseId,
        item.item_name,
        item.material_specifications || null,
        item.brand || null,
        Number(quantity),
        item.unit,
        item.project_id || null,
        reason
      ]);

      // 4. Log transaction
      const txQuery = `
        INSERT INTO inventory_transactions 
        (tenant_id, warehouse_id, transaction_type, project_id, item_name, material_specifications, brand, quantity, unit, notes, created_by)
        VALUES ($1, $2, 'quarantine_damaged', $3, $4, $5, $6, $7, $8, $9, $10)
      `;
      await client.query(txQuery, [
        tenantId,
        warehouseId,
        item.project_id || null,
        item.item_name,
        item.material_specifications || null,
        item.brand || null,
        Number(quantity),
        item.unit,
        `Quarantined: ${reason}. ${notes || ''}`.trim(),
        userId || null
      ]);

      await client.query('COMMIT');
      return qRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async releaseFromQuarantine(tenantId, userId, data) {
    const { warehouseId, quarantinedItemId, quantity, notes } = data;
    if (!warehouseId || !quarantinedItemId || !quantity) {
      throw new Error('Missing required fields: warehouseId, quarantinedItemId, quantity');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get quarantined item
      const itemRes = await client.query(
        'SELECT * FROM quarantined_items WHERE id = $1 AND warehouse_id = $2 AND tenant_id = $3',
        [quarantinedItemId, warehouseId, tenantId]
      );
      if (itemRes.rows.length === 0) throw new Error('Quarantined item not found');
      const item = itemRes.rows[0];

      if (Number(item.quantity) < Number(quantity)) {
        throw new Error(`Insufficient quarantined stock. Available: ${item.quantity} ${item.unit}`);
      }

      // 2. Decrement quarantined stock
      const updatedQty = Number(item.quantity) - Number(quantity);
      if (updatedQty <= 0) {
        await client.query('DELETE FROM quarantined_items WHERE id = $1', [quarantinedItemId]);
      } else {
        await client.query(
          'UPDATE quarantined_items SET quantity = $1, updated_at = NOW() WHERE id = $2',
          [updatedQty, quarantinedItemId]
        );
      }

      // 3. Add back to active inventory
      const activeQuery = `
        INSERT INTO inventory_items 
        (tenant_id, warehouse_id, item_name, material_specifications, brand, quantity, unit, project_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (tenant_id, warehouse_id, item_name, COALESCE(brand, ''), COALESCE(material_specifications, ''), COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid))
        DO UPDATE SET 
          quantity = inventory_items.quantity + EXCLUDED.quantity,
          updated_at = NOW()
        RETURNING *
      `;
      const activeRes = await client.query(activeQuery, [
        tenantId,
        warehouseId,
        item.item_name,
        item.material_specifications || null,
        item.brand || null,
        Number(quantity),
        item.unit,
        item.project_id || null
      ]);

      // 4. Log transaction
      const txQuery = `
        INSERT INTO inventory_transactions 
        (tenant_id, warehouse_id, transaction_type, project_id, item_name, material_specifications, brand, quantity, unit, notes, created_by)
        VALUES ($1, $2, 'release_from_quarantine', $3, $4, $5, $6, $7, $8, $9, $10)
      `;
      await client.query(txQuery, [
        tenantId,
        warehouseId,
        item.project_id || null,
        item.item_name,
        item.material_specifications || null,
        item.brand || null,
        Number(quantity),
        item.unit,
        notes || 'Released from quarantine to active inventory.',
        userId || null
      ]);

      await client.query('COMMIT');
      return activeRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = new WarehouseService();
