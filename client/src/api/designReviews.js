import api from './axios';

export const getAll = async (params) => {
  return await api.get('/designReviews', { params });
};

export const getById = async (id) => {
  return await api.get(`/designReviews/${id}`);
};

export const create = async (data) => {
  return await api.post('/designReviews', data);
};

export const update = async (id, data) => {
  return await api.put(`/designReviews/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/designReviews/${id}`);
};
