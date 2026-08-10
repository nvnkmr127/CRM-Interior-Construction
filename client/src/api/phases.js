import api from './axios';

export const getAll = async (params) => {
  return await api.get('/phases', { params });
};

export const getById = async (id) => {
  return await api.get(`/phases/${id}`);
};

export const create = async (data) => {
  return await api.post('/phases', data);
};

export const update = async (id, data) => {
  return await api.put(`/phases/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/phases/${id}`);
};
