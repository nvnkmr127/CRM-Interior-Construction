import api from './axios';

export const getAll = async (params) => {
  return await api.get('/projectRetrospectives', { params });
};

export const getById = async (id) => {
  return await api.get(`/projectRetrospectives/${id}`);
};

export const create = async (data) => {
  return await api.post('/projectRetrospectives', data);
};

export const update = async (id, data) => {
  return await api.put(`/projectRetrospectives/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/projectRetrospectives/${id}`);
};
