import api from './axios';

export const getWarehouses = () => {
  return api.get('/warehouses');
};

export const createWarehouse = (data) => {
  return api.post('/warehouses', data);
};

export const getWarehouseInventory = (warehouseId, projectId) => {
  const query = projectId ? `?projectId=${projectId}` : '';
  return api.get(`/warehouses/${warehouseId}/inventory${query}`);
};

export const getWarehouseQuarantined = (warehouseId) => {
  return api.get(`/warehouses/${warehouseId}/quarantined`);
};

export const getWarehouseTransactions = (warehouseId) => {
  return api.get(`/warehouses/${warehouseId}/transactions`);
};

export const receiveMaterial = (warehouseId, data) => {
  return api.post(`/warehouses/${warehouseId}/receive`, data);
};

export const dispatchToSite = (warehouseId, data) => {
  return api.post(`/warehouses/${warehouseId}/dispatch`, data);
};

export const returnFromSite = (warehouseId, data) => {
  return api.post(`/warehouses/${warehouseId}/return`, data);
};

export const quarantineMaterial = (warehouseId, data) => {
  return api.post(`/warehouses/${warehouseId}/quarantine`, data);
};

export const releaseFromQuarantine = (warehouseId, data) => {
  return api.post(`/warehouses/${warehouseId}/release`, data);
};
