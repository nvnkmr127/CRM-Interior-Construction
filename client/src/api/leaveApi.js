import api from './axios';

export const getLeaves = async (params = {}) => {
  const { data } = await api.get('/leaves', { params });
  return data.data;
};

export const getTeamSchedule = async () => {
  const { data } = await api.get('/leaves/schedule');
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

export const deleteLeave = async (leaveId, payload = {}) => {
  const { data } = await api.delete(`/leaves/${leaveId}`, { data: payload });
  return data.data;
};

export const updateLeaveStatus = async (leaveId, status) => {
  const { data } = await api.patch(`/leaves/${leaveId}/status`, { status });
  return data.data;
};

export const getCoveringLeaves = async () => {
  const { data } = await api.get('/leaves/covering');
  return data.data;
};

export const getProjectCoverages = async (projectId) => {
  const { data } = await api.get(`/leaves/project/${projectId}`);
  return data.data;
};
