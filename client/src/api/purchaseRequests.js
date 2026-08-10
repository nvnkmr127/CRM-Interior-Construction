import api from './axios';

export const getAll = async (params) => {
  return await api.get('/purchaseRequests', { params });
};

export const getById = async (id) => {
  return await api.get(`/purchaseRequests/${id}`);
};

export const create = async (data) => {
  return await api.post('/purchaseRequests', data);
};

export const update = async (id, data) => {
  return await api.put(`/purchaseRequests/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/purchaseRequests/${id}`);
};
