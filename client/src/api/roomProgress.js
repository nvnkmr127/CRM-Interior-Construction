import api from './axios';

export const getAll = async (params) => {
  return await api.get('/roomProgress', { params });
};

export const getById = async (id) => {
  return await api.get(`/roomProgress/${id}`);
};

export const create = async (data) => {
  return await api.post('/roomProgress', data);
};

export const update = async (id, data) => {
  return await api.put(`/roomProgress/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/roomProgress/${id}`);
};
