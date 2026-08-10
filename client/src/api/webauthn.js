import api from './axios';

export const getAll = async (params) => {
  return await api.get('/webauthn', { params });
};

export const getById = async (id) => {
  return await api.get(`/webauthn/${id}`);
};

export const create = async (data) => {
  return await api.post('/webauthn', data);
};

export const update = async (id, data) => {
  return await api.put(`/webauthn/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/webauthn/${id}`);
};
