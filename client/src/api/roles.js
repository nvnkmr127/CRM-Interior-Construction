import api from './axios';

export const getAll = async (params) => {
  return await api.get('/roles', { params });
};

export const getById = async (id) => {
  return await api.get(`/roles/${id}`);
};

export const create = async (data) => {
  return await api.post('/roles', data);
};

export const update = async (id, data) => {
  return await api.put(`/roles/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/roles/${id}`);
};
