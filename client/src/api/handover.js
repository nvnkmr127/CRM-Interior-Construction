import api from './axios.js'

export const handoverApi = {
  getChecklist:  (projectId) => api.get(`/projects/${projectId}/handover/checklists`).then(r=>r.data.data),
  createChecklist:(projectId) => api.post(`/projects/${projectId}/handover/checklists`).then(r=>r.data.data),
  updateItem:    (itemId,data)=> api.patch(`/handover/items/${itemId}`, data).then(r=>r.data.data),
  signOff:       (checklistId)=> api.post(`/handover/checklists/${checklistId}/sign-off`).then(r=>r.data.data),
}
