import api from './axios';

export const getAll = async (params) => {
  return await api.get('/superadmin', { params });
};

export const getById = async (id) => {
  return await api.get(`/superadmin/${id}`);
};

export const create = async (data) => {
  return await api.post('/superadmin', data);
};

export const update = async (id, data) => {
  return await api.put(`/superadmin/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/superadmin/${id}`);
};
