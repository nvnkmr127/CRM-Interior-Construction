import api from './index';

export const getLeaves = async () => {
  const { data } = await api.get('/api/leaves');
  return data;
};

export const getLeaveImpact = async (userId) => {
  const { data } = await api.get(`/api/leaves/impact/${userId}`);
  return data;
};

export const createLeave = async (leaveData) => {
  const { data } = await api.post('/api/leaves', leaveData);
  return data;
};
