import api from './axios';

export const getAll = async (params) => {
  return await api.get('/logs', { params });
};

export const getById = async (id) => {
  return await api.get(`/logs/${id}`);
};

export const create = async (data) => {
  return await api.post('/logs', data);
};

export const update = async (id, data) => {
  return await api.put(`/logs/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/logs/${id}`);
};
