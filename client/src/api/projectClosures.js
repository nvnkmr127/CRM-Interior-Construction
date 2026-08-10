import api from './axios';

export const getAll = async (params) => {
  return await api.get('/projectClosures', { params });
};

export const getById = async (id) => {
  return await api.get(`/projectClosures/${id}`);
};

export const create = async (data) => {
  return await api.post('/projectClosures', data);
};

export const update = async (id, data) => {
  return await api.put(`/projectClosures/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/projectClosures/${id}`);
};
