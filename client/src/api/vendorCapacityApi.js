import api from './index';

export const getVendorCapacityReport = async () => {
  const { data } = await api.get('/analytics/vendors-capacity');
  return data;
};

export const updateVendorCapacityProfile = async (vendorName, profileData) => {
  const { data } = await api.patch(`/analytics/vendors-capacity/${encodeURIComponent(vendorName)}`, profileData);
  return data;
};
