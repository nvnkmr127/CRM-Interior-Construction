import api from './axios';

export const getVendorCapacityReport = async () => {
  const { data } = await api.get('/analytics/vendors-capacity');
  return data.data;
};

export const updateVendorCapacityProfile = async (vendorName, profileData) => {
  const { data } = await api.patch(`/analytics/vendors-capacity/${encodeURIComponent(vendorName)}`, profileData);
  return data.data;
};
