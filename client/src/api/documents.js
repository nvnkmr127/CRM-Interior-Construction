import api from './axios';

export const getAll = async (params) => {
  return await api.get('/documents', { params });
};

export const getById = async (id) => {
  return await api.get(`/documents/${id}`);
};

export const create = async (data) => {
  return await api.post('/documents', data);
};

export const update = async (id, data) => {
  return await api.put(`/documents/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/documents/${id}`);
};
