const fs = require('fs');
const apiPath = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/api/analytics.js';
let content = fs.readFileSync(apiPath, 'utf8');

const newExports = `
export const getLeadSummary = (params) => api.get('/analytics/leads/summary', { params }).then(r=>r.data.data);
export const getLeadFunnel = (params) => api.get('/analytics/leads/funnel', { params }).then(r=>r.data.data);
export const getLeadsBySource = (params) => api.get('/analytics/leads/by_source', { params }).then(r=>r.data.data);
export const getRepPerformance = (params) => api.get('/analytics/leads/rep_performance', { params }).then(r=>r.data.data);
export const getLostReasons = (params) => api.get('/analytics/leads/lost_reasons', { params }).then(r=>r.data.data);
export const getRevenue = (params) => api.get('/analytics/revenue', { params }).then(r=>r.data.data);
export const getPipeline = (params) => api.get('/analytics/pipeline', { params }).then(r=>r.data.data);
export const getConversion = (params) => api.get('/analytics/conversion', { params }).then(r=>r.data.data);
export const getForecast = (params) => api.get('/analytics/forecast', { params }).then(r=>r.data.data);
`;

if (!content.includes('getLeadSummary')) {
  content += '\n' + newExports;
  fs.writeFileSync(apiPath, content);
  console.log('API endpoints injected');
} else {
  console.log('API endpoints already exist');
}
