import api from './axios.js'

export const notificationsApi = {
  getAll:       (limit=20) => api.get(`/notifications?limit=${limit}`).then(r=>r.data.data),
  getUnreadCount: ()       => api.get('/notifications/unread-count').then(r=>r.data.data),
  markRead:     (ids)      => api.post('/notifications/mark-read', { ids }).then(r=>r.data),
  markAllRead:  ()         => api.post('/notifications/mark-read', { all:true }).then(r=>r.data),
}
