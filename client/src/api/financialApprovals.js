import api from './axios';

export const getAll = async (params) => {
  return await api.get('/financialApprovals', { params });
};

export const getById = async (id) => {
  return await api.get(`/financialApprovals/${id}`);
};

export const create = async (data) => {
  return await api.post('/financialApprovals', data);
};

export const update = async (id, data) => {
  return await api.put(`/financialApprovals/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/financialApprovals/${id}`);
};
