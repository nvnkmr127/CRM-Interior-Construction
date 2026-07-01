import api from './axios';

export const getLeadAnalytics = (params) => api.get('/analytics/leads', { params }).then(r=>r.data.data);

export const getProjectAnalytics = (params) => api.get('/analytics/projects', { params }).then(r=>r.data.data);

export const getVendorPerformanceReport = () => api.get('/analytics/vendors').then(r=>r.data.data);

export const getVendorPerformanceDetail = (vendorName) => api.get(`/analytics/vendors/${encodeURIComponent(vendorName)}`).then(r=>r.data.data);

export const getCollectionForecast = () => api.get('/analytics/collection-forecast').then(r=>r.data.data);

export const getProfitabilityAnalytics = () => api.get('/analytics/profitability').then(r=>r.data.data);

export const getResourceUtilisationReport = () => api.get('/analytics/resource-utilisation').then(r=>r.data.data);
export const getCSATAnalyticsReport = () => api.get('/analytics/csat').then(r=>r.data.data);
export const getSnagsAnalytics = (projectId) => api.get('/analytics/snags', { params: { projectId } }).then(r=>r.data.data);

export const getPaymentAgingReport = async () => {
  const res = await api.get('/analytics/payment-aging');
  return res.data.data;
};

