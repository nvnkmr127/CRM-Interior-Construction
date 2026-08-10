import api from './axios';

export const getAll = async (params) => {
  return await api.get('/sessions', { params });
};

export const getById = async (id) => {
  return await api.get(`/sessions/${id}`);
};

export const create = async (data) => {
  return await api.post('/sessions', data);
};

export const update = async (id, data) => {
  return await api.put(`/sessions/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/sessions/${id}`);
};
