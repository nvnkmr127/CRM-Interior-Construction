import api from './axios';

export const getAll = async (params) => {
  return await api.get('/apiTokens', { params });
};

export const getById = async (id) => {
  return await api.get(`/apiTokens/${id}`);
};

export const create = async (data) => {
  return await api.post('/apiTokens', data);
};

export const update = async (id, data) => {
  return await api.put(`/apiTokens/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/apiTokens/${id}`);
};
