import api from './axios';

export const getAll = async (params) => {
  return await api.get('/security', { params });
};

export const getById = async (id) => {
  return await api.get(`/security/${id}`);
};

export const create = async (data) => {
  return await api.post('/security', data);
};

export const update = async (id, data) => {
  return await api.put(`/security/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/security/${id}`);
};
