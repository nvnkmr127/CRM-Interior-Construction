import api from './axios';

export const getAll = async (params) => {
  return await api.get('/partners', { params });
};

export const getById = async (id) => {
  return await api.get(`/partners/${id}`);
};

export const create = async (data) => {
  return await api.post('/partners', data);
};

export const update = async (id, data) => {
  return await api.put(`/partners/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/partners/${id}`);
};
