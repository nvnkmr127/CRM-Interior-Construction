import api from './axios';

export const login = async (email, password, tenantSlug) => {
  const response = await api.post('/auth/login', { email, password, tenantSlug });
  return response.data;
};

export const register = async (name, email, password, tenantSlug) => {
  const response = await api.post('/auth/register', { name, email, password, tenantSlug });
  return response.data;
};

export const logout = async (refreshToken) => {
  const response = await api.post('/auth/logout', { refreshToken });
  return response.data;
};

export const me = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const refreshToken = async (token) => {
  const response = await api.post('/auth/refresh', { refreshToken: token });
  return response.data;
};
