import api from './axios';

export const getAll = async (params) => {
  return await api.get('/siteExpenses', { params });
};

export const getById = async (id) => {
  return await api.get(`/siteExpenses/${id}`);
};

export const create = async (data) => {
  return await api.post('/siteExpenses', data);
};

export const update = async (id, data) => {
  return await api.put(`/siteExpenses/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/siteExpenses/${id}`);
};
