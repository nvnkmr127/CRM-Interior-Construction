import api from './axios';

export const getAll = async (params) => {
  return await api.get('/delayNotifications', { params });
};

export const getById = async (id) => {
  return await api.get(`/delayNotifications/${id}`);
};

export const create = async (data) => {
  return await api.post('/delayNotifications', data);
};

export const update = async (id, data) => {
  return await api.put(`/delayNotifications/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/delayNotifications/${id}`);
};
