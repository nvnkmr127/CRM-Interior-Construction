import api from './axios';

export const getAll = async (params) => {
  return await api.get('/manager', { params });
};

export const getById = async (id) => {
  return await api.get(`/manager/${id}`);
};

export const create = async (data) => {
  return await api.post('/manager', data);
};

export const update = async (id, data) => {
  return await api.put(`/manager/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/manager/${id}`);
};
