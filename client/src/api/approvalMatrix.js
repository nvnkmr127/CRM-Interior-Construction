import api from './axios';

export const getAll = async (params) => {
  return await api.get('/approvalMatrix', { params });
};

export const getById = async (id) => {
  return await api.get(`/approvalMatrix/${id}`);
};

export const create = async (data) => {
  return await api.post('/approvalMatrix', data);
};

export const update = async (id, data) => {
  return await api.put(`/approvalMatrix/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/approvalMatrix/${id}`);
};
