import api from './axios';

export const getGlobalTasks = (params) => api.get('/tasks', { params });
export const getTasks = (projectId, params) => api.get(`/projects/${projectId}/tasks`, { params });
export const getTask = (projectId, taskId) => api.get(`/projects/${projectId}/tasks/${taskId}`);
export const createTask = (projectId, data) => api.post(`/projects/${projectId}/tasks`, data);
export const updateTask = (projectId, taskId, data) => api.patch(`/projects/${projectId}/tasks/${taskId}`, data);
export const deleteTask = (projectId, taskId) => api.delete(`/projects/${projectId}/tasks/${taskId}`);
export const addTaskComment = (projectId, taskId, content) => api.post(`/projects/${projectId}/tasks/${taskId}/comments`, { content });
