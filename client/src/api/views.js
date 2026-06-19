import api from './axios';

export const getViews = async () => {
  const response = await api.get('/views');
  return response.data;
};

export const createView = async (data) => {
  const response = await api.post('/views', data);
  return response.data;
};

export const updateView = async (id, data) => {
  const response = await api.put(`/views/${id}`, data);
  return response.data;
};

export const deleteView = async (id) => {
  const response = await api.delete(`/views/${id}`);
  return response.data;
};
