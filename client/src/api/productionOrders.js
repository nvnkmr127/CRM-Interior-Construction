import api from './axios';

export const getAll = async (params) => {
  return await api.get('/productionOrders', { params });
};

export const getById = async (id) => {
  return await api.get(`/productionOrders/${id}`);
};

export const create = async (data) => {
  return await api.post('/productionOrders', data);
};

export const update = async (id, data) => {
  return await api.put(`/productionOrders/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/productionOrders/${id}`);
};
