import api from './axios';

export const getAll = async (params) => {
  return await api.get('/taskDependencies', { params });
};

export const getById = async (id) => {
  return await api.get(`/taskDependencies/${id}`);
};

export const create = async (data) => {
  return await api.post('/taskDependencies', data);
};

export const update = async (id, data) => {
  return await api.put(`/taskDependencies/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/taskDependencies/${id}`);
};
