const warehouseService = require('../services/projects/warehouseService');
const { success, fail } = require('../utils/response');

exports.listWarehouses = async (req, res) => {
  try {
    const list = await warehouseService.listWarehouses(req.tenantId);
    return success(res, list);
  } catch (err) {
    console.error('[Warehouse Controller] List error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to retrieve warehouses.', 500);
  }
};

exports.createWarehouse = async (req, res) => {
  try {
    const { name, location } = req.body;
    if (!name) return fail(res, 'VALIDATION_ERROR', 'Warehouse name is required.', 400);

    const warehouse = await warehouseService.createWarehouse(req.tenantId, { name, location });
    return success(res, warehouse, {}, 201);
  } catch (err) {
    console.error('[Warehouse Controller] Create error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create warehouse.', 500);
  }
};

exports.getInventory = async (req, res) => {
  try {
    const { warehouseId } = req.params;
    const { projectId } = req.query;
    const inventory = await warehouseService.getInventory(req.tenantId, warehouseId, projectId);
    return success(res, inventory);
  } catch (err) {
    console.error('[Warehouse Controller] Inventory error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to retrieve inventory items.', 500);
  }
};

exports.getQuarantined = async (req, res) => {
  try {
    const { warehouseId } = req.params;
    const quarantined = await warehouseService.getQuarantined(req.tenantId, warehouseId);
    return success(res, quarantined);
  } catch (err) {
    console.error('[Warehouse Controller] Quarantined error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to retrieve quarantined items.', 500);
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const { warehouseId } = req.params;
    const transactions = await warehouseService.getTransactions(req.tenantId, warehouseId);
    return success(res, transactions);
  } catch (err) {
    console.error('[Warehouse Controller] Transactions error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to retrieve inventory transactions.', 500);
  }
};

exports.receiveMaterial = async (req, res) => {
  try {
    const { warehouseId } = req.params;
    const item = await warehouseService.receiveMaterial(req.tenantId, req.user?.userId, {
      warehouseId,
      ...req.body
    });
    return success(res, item, {}, 201);
  } catch (err) {
    console.error('[Warehouse Controller] Receive error:', err);
    return fail(res, 'BAD_REQUEST', err.message, 400);
  }
};

exports.dispatchToSite = async (req, res) => {
  try {
    const { warehouseId } = req.params;
    const item = await warehouseService.dispatchToSite(req.tenantId, req.user?.userId, {
      warehouseId,
      ...req.body
    });
    return success(res, item);
  } catch (err) {
    console.error('[Warehouse Controller] Dispatch error:', err);
    return fail(res, 'BAD_REQUEST', err.message, 400);
  }
};

exports.returnFromSite = async (req, res) => {
  try {
    const { warehouseId } = req.params;
    const item = await warehouseService.returnFromSite(req.tenantId, req.user?.userId, {
      warehouseId,
      ...req.body
    });
    return success(res, item, {}, 201);
  } catch (err) {
    console.error('[Warehouse Controller] Return error:', err);
    return fail(res, 'BAD_REQUEST', err.message, 400);
  }
};

exports.quarantineMaterial = async (req, res) => {
  try {
    const { warehouseId } = req.params;
    const item = await warehouseService.quarantineMaterial(req.tenantId, req.user?.userId, {
      warehouseId,
      ...req.body
    });
    return success(res, item);
  } catch (err) {
    console.error('[Warehouse Controller] Quarantine error:', err);
    return fail(res, 'BAD_REQUEST', err.message, 400);
  }
};

exports.releaseFromQuarantine = async (req, res) => {
  try {
    const { warehouseId } = req.params;
    const item = await warehouseService.releaseFromQuarantine(req.tenantId, req.user?.userId, {
      warehouseId,
      ...req.body
    });
    return success(res, item);
  } catch (err) {
    console.error('[Warehouse Controller] Release error:', err);
    return fail(res, 'BAD_REQUEST', err.message, 400);
  }
};
