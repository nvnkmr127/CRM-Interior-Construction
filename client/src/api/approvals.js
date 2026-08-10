import api from './axios';

export const getAll = async (params) => {
  return await api.get('/approvals', { params });
};

export const getById = async (id) => {
  return await api.get(`/approvals/${id}`);
};

export const create = async (data) => {
  return await api.post('/approvals', data);
};

export const update = async (id, data) => {
  return await api.put(`/approvals/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/approvals/${id}`);
};
