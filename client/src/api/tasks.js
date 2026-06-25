import api from './axios';

export const getGlobalTasks = (params) => api.get('/tasks', { params });
export const getGlobalTask = (taskId) => api.get(`/tasks/${taskId}`);
export const createGlobalTask = (data) => api.post('/tasks', data);
export const updateGlobalTask = (taskId, data) => api.patch(`/tasks/${taskId}`, data);
export const deleteGlobalTask = (taskId) => api.delete(`/tasks/${taskId}`);
export const getGlobalTaskComments = (taskId) => api.get(`/tasks/${taskId}/comments`);
export const addGlobalTaskComment = (taskId, content) => api.post(`/tasks/${taskId}/comments`, { content });

export const getTasks = (projectId, params) => api.get(`/projects/${projectId}/tasks`, { params });
export const getTask = (projectId, taskId) => api.get(`/projects/${projectId}/tasks/${taskId}`);
export const createTask = (projectId, data) => api.post(`/projects/${projectId}/tasks`, data);
export const updateTask = (projectId, taskId, data) => api.patch(`/projects/${projectId}/tasks/${taskId}`, data);
export const deleteTask = (projectId, taskId) => api.delete(`/projects/${projectId}/tasks/${taskId}`);
export const addTaskComment = (projectId, taskId, content) => api.post(`/projects/${projectId}/tasks/${taskId}/comments`, { content });
