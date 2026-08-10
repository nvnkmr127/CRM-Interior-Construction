import api from './axios';

export const getAll = async (params) => {
  return await api.get('/changeOrders', { params });
};

export const getById = async (id) => {
  return await api.get(`/changeOrders/${id}`);
};

export const create = async (data) => {
  return await api.post('/changeOrders', data);
};

export const update = async (id, data) => {
  return await api.put(`/changeOrders/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/changeOrders/${id}`);
};
