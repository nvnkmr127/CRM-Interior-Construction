import api from './axios';

export const getAll = async (params) => {
  return await api.get('/milestones', { params });
};

export const getById = async (id) => {
  return await api.get(`/milestones/${id}`);
};

export const create = async (data) => {
  return await api.post('/milestones', data);
};

export const update = async (id, data) => {
  return await api.put(`/milestones/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/milestones/${id}`);
};
