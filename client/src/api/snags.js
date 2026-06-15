import api from './axios';

export const getSnags = (params) => api.get('/snags', { params });

export const updateSnag = (id, data) => api.patch(`/snags/${id}`, data);
