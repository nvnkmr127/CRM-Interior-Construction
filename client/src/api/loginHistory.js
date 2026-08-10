import api from './axios';

export const getAll = async (params) => {
  return await api.get('/loginHistory', { params });
};

export const getById = async (id) => {
  return await api.get(`/loginHistory/${id}`);
};

export const create = async (data) => {
  return await api.post('/loginHistory', data);
};

export const update = async (id, data) => {
  return await api.put(`/loginHistory/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/loginHistory/${id}`);
};
