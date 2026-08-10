import api from './axios';

export const getAll = async (params) => {
  return await api.get('/offboarding', { params });
};

export const getById = async (id) => {
  return await api.get(`/offboarding/${id}`);
};

export const create = async (data) => {
  return await api.post('/offboarding', data);
};

export const update = async (id, data) => {
  return await api.put(`/offboarding/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/offboarding/${id}`);
};
