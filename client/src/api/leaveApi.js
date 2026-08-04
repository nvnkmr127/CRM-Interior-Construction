import api from './axios';

export const getLeaves = async () => {
  const { data } = await api.get('/leaves');
  return data.data;
};

export const getLeaveImpact = async (userId) => {
  const { data } = await api.get(`/leaves/impact/${userId}`);
  return data.data;
};

export const createLeave = async (leaveData) => {
  const { data } = await api.post('/leaves', leaveData);
  return data.data;
};
