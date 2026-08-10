import api from './axios';

export const getAll = async (params) => {
  return await api.get('/baselineAssessment', { params });
};

export const getById = async (id) => {
  return await api.get(`/baselineAssessment/${id}`);
};

export const create = async (data) => {
  return await api.post('/baselineAssessment', data);
};

export const update = async (id, data) => {
  return await api.put(`/baselineAssessment/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/baselineAssessment/${id}`);
};
