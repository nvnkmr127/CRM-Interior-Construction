import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  withCredentials: true,  // send cookies
  headers: { 'Content-Type': 'application/json' },
});

// REQUEST interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('crm_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// RESPONSE interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // On network error: reject with { code: 'NETWORK_ERROR' }
    if (!error.response) {
      return Promise.reject({ code: 'NETWORK_ERROR', message: 'Network error or server unreachable', originalError: error });
    }

    const originalRequest = error.config;

    // Handle 401 Unauthorized
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // POST /auth/refresh (no auth header, relying on httpOnly cookie)
        const refreshResponse = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        if (refreshResponse.data && refreshResponse.data.data.accessToken) {
          const newAccessToken = refreshResponse.data.data.accessToken;
          
          // Store new token in localStorage
          localStorage.setItem('crm_access_token', newAccessToken);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh token failed/expired
        localStorage.removeItem('crm_access_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // If _retry is true and we still got 401 -> redirect to login (prevent infinite loop)
    if (error.response.status === 401 && originalRequest._retry) {
      localStorage.removeItem('crm_access_token');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;
