import api from './axios.js'

export const configApi = {
  // Custom fields
  getCustomFields: (entity) => api.get(`/config/custom-fields?entity=${entity}`).then(r=>r.data.data),
  addCustomField:  (data)   => api.post('/config/custom-fields', data).then(r=>r.data.data),
  updateCustomField:(id,d)  => api.put(`/config/custom-fields/${id}`, d).then(r=>r.data.data),
  deleteCustomField:(id)    => api.delete(`/config/custom-fields/${id}`),

  // Lead stages
  getLeadStages:   ()        => api.get('/config/lead-stages').then(r=>r.data.data),
  addLeadStage:    (data)    => api.post('/config/lead-stages', data).then(r=>r.data.data),
  updateLeadStage: (id,data) => api.put(`/config/lead-stages/${id}`, data).then(r=>r.data.data),
  deleteLeadStage: (id)      => api.delete(`/config/lead-stages/${id}`),
  reorderLeadStages:(ids)    => api.patch('/config/lead-stages/reorder', { orderedIds:ids }),

  // Templates
  getTemplates:    ()        => api.get('/config/project-templates').then(r=>r.data.data),
  createTemplate:  (data)    => api.post('/config/project-templates', data).then(r=>r.data.data),
  updateTemplate:  (id,data) => api.put(`/config/project-templates/${id}`, data).then(r=>r.data.data),
  deleteTemplate:  (id)      => api.delete(`/config/project-templates/${id}`),

  // Automations
  getAutomations:    ()        => api.get('/config/automations').then(r=>r.data.data),
  createAutomation:  (data)    => api.post('/config/automations', data).then(r=>r.data.data),
  updateAutomation:  (id,data) => api.put(`/config/automations/${id}`, data).then(r=>r.data.data),
  deleteAutomation:  (id)      => api.delete(`/config/automations/${id}`),
  toggleAutomation:  (id)      => api.patch(`/config/automations/${id}/toggle`).then(r=>r.data.data),
  testAutomation:    (id,record)=> api.post(`/config/automations/${id}/test-run`,{record}).then(r=>r.data.data),

  // API Keys
  getApiKeys:    ()       => api.get('/config/api-keys').then(r=>r.data.data),
  createApiKey:  (data)   => api.post('/config/api-keys', data).then(r=>r.data.data),
  revokeApiKey:  (id)     => api.delete(`/config/api-keys/${id}`),

  // Webhooks
  getWebhooks:    ()       => api.get('/config/webhooks').then(r=>r.data.data),
  createWebhook:  (data)   => api.post('/config/webhooks', data).then(r=>r.data.data),
  updateWebhook:  (id,d)   => api.put(`/config/webhooks/${id}`, d).then(r=>r.data.data),
  deleteWebhook:  (id)     => api.delete(`/config/webhooks/${id}`),
  testWebhook:    (id)     => api.post(`/config/webhooks/${id}/test`).then(r=>r.data.data),
  toggleWebhook:  (id)     => api.patch(`/config/webhooks/${id}/toggle`).then(r=>r.data.data),

  // Logs
  getWebhookLogs: (params) => api.get('/logs/webhook-events', {params}).then(r=>r.data),
  getInboundLogs: (params) => api.get('/logs/inbound', {params}).then(r=>r.data),
  retryWebhook:   (logId)  => api.post(`/logs/webhook-events/${logId}/retry`).then(r=>r.data.data),

  // Trade activity templates
  getTradeTemplates: (params) => api.get('/config/trade-activity-templates', { params }).then(r=>r.data.data),
  createTradeTemplate: (data) => api.post('/config/trade-activity-templates', data).then(r=>r.data.data),
  updateTradeTemplate: (id, data) => api.patch(`/config/trade-activity-templates/${id}`, data).then(r=>r.data.data),
  deleteTradeTemplate: (id) => api.delete(`/config/trade-activity-templates/${id}`),

  // Trade dependency templates
  getTradeDependencyTemplates: () => api.get('/config/trade-dependency-templates').then(r=>r.data.data),
  createTradeDependencyTemplate: (data) => api.post('/config/trade-dependency-templates', data).then(r=>r.data.data),
  deleteTradeDependencyTemplate: (id) => api.delete(`/config/trade-dependency-templates/${id}`),

  // Email Templates
  getEmailTemplates: () => api.get('/email-templates').then(r=>r.data.data),
  saveEmailTemplate: (data) => api.post('/email-templates', data).then(r=>r.data.data),
  testEmailTemplate: (data) => api.post('/email-templates/test', data).then(r=>r.data.data),
}
