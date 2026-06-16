import api from './axios.js'

export const usersApi = {
  getAll:   (params={})  => api.get('/users', { params }).then(r=>r.data.data),
  update:   (id, data)   => api.patch(`/users/${id}`, data).then(r=>r.data.data),
  invite:   (data)       => api.post('/users/invite', data).then(r=>r.data.data),
  updateMe: (data)       => api.patch('/auth/me', data).then(r=>r.data.data),
  changePassword: (data) => api.post('/auth/change-password', data).then(r=>r.data),
  signOutAll: ()         => api.delete('/auth/sessions').then(r=>r.data),
}
