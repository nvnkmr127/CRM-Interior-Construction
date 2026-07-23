import api from './axios.js'

export const orgApi = {
  // Users Org Data
  getHierarchy: () => api.get('/org/hierarchy').then(r => r.data.data),
  updateUserOrgInfo: (id, data) => api.patch(`/org/users/${id}`, data).then(r => r.data.data),
  batchAssignUsers: (data) => api.patch('/org/users/batch-assign', data).then(r => r.data.data),

  // Departments
  getDepartments: () => api.get('/org/departments').then(r => r.data.data),
  createDepartment: (data) => api.post('/org/departments', data).then(r => r.data.data),
  updateDepartment: (id, data) => api.patch(`/org/departments/${id}`, data).then(r => r.data.data),
  deleteDepartment: (id) => api.delete(`/org/departments/${id}`),

  // Branches
  getBranches: () => api.get('/org/branches').then(r => r.data.data),
  createBranch: (data) => api.post('/org/branches', data).then(r => r.data.data),
  updateBranch: (id, data) => api.patch(`/org/branches/${id}`, data).then(r => r.data.data),
  deleteBranch: (id) => api.delete(`/org/branches/${id}`),
}
