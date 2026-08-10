import api from './axios';

export const getAll = async (params) => {
  return await api.get('/sequences', { params });
};

export const getById = async (id) => {
  return await api.get(`/sequences/${id}`);
};

export const create = async (data) => {
  return await api.post('/sequences', data);
};

export const update = async (id, data) => {
  return await api.put(`/sequences/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/sequences/${id}`);
};
