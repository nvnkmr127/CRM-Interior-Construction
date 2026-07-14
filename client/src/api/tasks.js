import api from './axios';

export const getGlobalTasks = (params) => api.get('/tasks', { params });
export const getGlobalTask = (taskId) => api.get(`/tasks/${taskId}`);
export const createGlobalTask = (data) => api.post('/tasks', data);
export const updateGlobalTask = (taskId, data) => api.patch(`/tasks/${taskId}`, data);
export const deleteGlobalTask = (taskId) => api.delete(`/tasks/${taskId}`);
export const getGlobalTaskComments = (taskId, params) => api.get(`/tasks/${taskId}/comments`, { params });
export const addGlobalTaskComment = (taskId, data) => api.post(`/tasks/${taskId}/comments`, data);
export const updateGlobalTaskComment = (taskId, commentId, data) => api.patch(`/tasks/${taskId}/comments/${commentId}`, data);
export const deleteGlobalTaskComment = (taskId, commentId) => api.delete(`/tasks/${taskId}/comments/${commentId}`);
export const reactGlobalTaskComment = (taskId, commentId, reaction) => api.post(`/tasks/${taskId}/comments/${commentId}/reactions`, { reaction });

export const getGlobalTaskAttachments = (taskId) => api.get(`/tasks/${taskId}/attachments`);
export const uploadGlobalTaskAttachment = (taskId, data) => api.post(`/tasks/${taskId}/attachments`, data);
export const deleteGlobalTaskAttachment = (taskId, attachmentId) => api.delete(`/tasks/${taskId}/attachments/${attachmentId}`);
export const replaceGlobalTaskAttachment = (taskId, attachmentId, data) => api.patch(`/tasks/${taskId}/attachments/${attachmentId}`, data);

export const getGlobalTaskActivity = (taskId) => api.get(`/tasks/${taskId}/activity`);

export const getTaskTemplates = () => api.get('/task-templates');
export const createTaskTemplate = (data) => api.post('/task-templates', data);
export const updateTaskTemplate = (templateId, data) => api.patch(`/task-templates/${templateId}`, data);
export const deleteTaskTemplate = (templateId) => api.delete(`/task-templates/${templateId}`);

export const getTags = () => api.get('/tags');
export const createTag = (data) => api.post('/tags', data);
export const updateTag = (tagId, data) => api.patch(`/tags/${tagId}`, data);
export const deleteTag = (id) => api.delete(`/api/tags/${id}`);

export const getTaskViews = () => api.get('/api/task-views');
export const createTaskView = (data) => api.post('/api/task-views', data);
export const updateTaskView = (id, data) => api.patch(`/api/task-views/${id}`, data);
export const deleteTaskView = (id) => api.delete(`/api/task-views/${id}`);

export const getTasks = (projectId, params) => api.get(`/projects/${projectId}/tasks`, { params });
export const getTask = (projectId, taskId) => api.get(`/projects/${projectId}/tasks/${taskId}`);
export const createTask = (projectId, data) => api.post(`/projects/${projectId}/tasks`, data);
export const updateTask = (projectId, taskId, data) => api.patch(`/projects/${projectId}/tasks/${taskId}`, data);
export const deleteTask = (projectId, taskId) => api.delete(`/projects/${projectId}/tasks/${taskId}`);
export const addTaskComment = (projectId, taskId, data) => api.post(`/projects/${projectId}/tasks/${taskId}/comments`, data);
export const updateTaskComment = (projectId, taskId, commentId, data) => api.patch(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}`, data);
export const deleteTaskComment = (projectId, taskId, commentId) => api.delete(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}`);
export const reactTaskComment = (projectId, taskId, commentId, reaction) => api.post(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}/reactions`, { reaction });
export const getTaskComments = (projectId, taskId, params) => api.get(`/projects/${projectId}/tasks/${taskId}/comments`, { params });

export const getTaskAttachments = (projectId, taskId) => api.get(`/projects/${projectId}/tasks/${taskId}/attachments`);
export const uploadTaskAttachment = (projectId, taskId, data) => api.post(`/projects/${projectId}/tasks/${taskId}/attachments`, data);
export const deleteTaskAttachment = (projectId, taskId, attachmentId) => api.delete(`/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`);
export const replaceTaskAttachment = (projectId, taskId, attachmentId, data) => api.patch(`/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`, data);

export const getTaskActivity = (projectId, taskId) => api.get(`/projects/${projectId}/tasks/${taskId}/activity`);
