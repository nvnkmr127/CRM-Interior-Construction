import api from './axios';

export const getLeadAnalytics = (params) => api.get('/analytics/leads', { params }).then(r=>r.data.data);

export const getRevenueAnalytics = (params) => api.get('/analytics/revenue-leads', { params }).then(r=>r.data.data);

export const getLeadPredictions = (params) => api.get('/analytics/lead-predictions', { params }).then(r=>r.data.data);

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



export const getLeadSummary = (params) => api.get('/analytics/leads/summary', { params }).then(r=>r.data.data);
export const getLeadFunnel = (params) => api.get('/analytics/leads/funnel', { params }).then(r=>r.data.data);
export const getLeadsBySource = (params) => api.get('/analytics/leads/by_source', { params }).then(r=>r.data.data);
export const getRepPerformance = (params) => api.get('/analytics/leads/rep_performance', { params }).then(r=>r.data.data);
export const getLostReasons = (params) => api.get('/analytics/leads/lost_reasons', { params }).then(r=>r.data.data);
export const getRevenue = (params) => api.get('/analytics/revenue', { params }).then(r=>r.data.data);
export const getPipeline = (params) => api.get('/analytics/pipeline', { params }).then(r=>r.data.data);
export const getConversion = (params) => api.get('/analytics/conversion', { params }).then(r=>r.data.data);
export const getForecast = (params) => api.get('/analytics/forecast', { params }).then(r=>r.data.data);
export const getSalesCycle = (params) => api.get('/analytics/sales-cycle', { params }).then(r=>r.data.data);
export const getSalesProductivity = (params) => api.get('/analytics/sales-productivity', { params }).then(r=>r.data.data);
export const getSLADashboard = (params) => api.get('/analytics/sla', { params }).then(r=>r.data.data);

export const getCustomerAnalytics = (params) => api.get('/analytics/customer-demographics', { params }).then(r=>r.data.data);
export const getGeographicAnalytics = (params) => api.get('/analytics/geographic', { params }).then(r=>r.data.data);
export const getMarketingAnalytics = (params) => api.get('/analytics/marketing', { params }).then(r=>r.data.data);
export const getAIRevenueInsights = (params) => api.get('/analytics/ai-insights', { params }).then(r=>r.data.data);
export const getAIPredictions = (params) => api.get('/analytics/ai-predictions', { params }).then(r=>r.data.data);
