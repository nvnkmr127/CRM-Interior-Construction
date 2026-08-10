import api from './axios';

export const getAll = async (params) => {
  return await api.get('/qc', { params });
};

export const getById = async (id) => {
  return await api.get(`/qc/${id}`);
};

export const create = async (data) => {
  return await api.post('/qc', data);
};

export const update = async (id, data) => {
  return await api.put(`/qc/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/qc/${id}`);
};
