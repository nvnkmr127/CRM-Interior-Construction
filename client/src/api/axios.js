import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  withCredentials: true,  // send cookies
  headers: { 'Content-Type': 'application/json' },
});

// REQUEST interceptor (no longer needed for attaching tokens, cookies do this)
api.interceptors.request.use(
  (config) => {
    if (import.meta.env.DEV && localStorage.getItem('mockSession')) {
      // DEV mock: intercept all API calls and return a minimal valid response shape.
      // WARNING: mutations (POST/PATCH/DELETE) are silently swallowed here — nothing is
      // saved to the database. To test real data persistence, log in with real credentials
      // and clear the 'mockSession' key from localStorage.
      const method = (config.method || 'get').toLowerCase();
      const isMutation = ['post', 'patch', 'put', 'delete'].includes(method);
      if (isMutation) {
        console.warn(
          `[MockSession] ${method.toUpperCase()} ${config.url} intercepted — request NOT sent to server. ` +
          'Clear localStorage.mockSession to use real auth.'
        );
      }
      config.adapter = () => {
        return Promise.resolve({
          data: { success: true, data: {}, meta: {} },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {}
        });
      };
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Helper for triggering global toasts from outside React
const triggerToast = (type, message, duration = 4000) => {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { type, message, duration } }));
};

// RESPONSE interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // On network error or cancellation
    if (!error.response) {
      if (axios.isCancel(error)) {
        return Promise.reject(error);
      }
      window.dispatchEvent(new CustomEvent('app:network-error'));
      triggerToast('error', 'Network error. Check your connection.', 6000);
      return Promise.reject({ code: 'NETWORK_ERROR', message: 'Network error or server unreachable', originalError: error });
    }

    if (error.response.status === 422) {
      // Stage gate error — let the component handle it specifically
      return Promise.reject(error);
    }
    if (error.response.status === 403) {
      // Permission error — show toast
      triggerToast('error', 'You do not have permission to do that.', 6000);
      return Promise.reject(error);
    }
    if (error.response.status === 429) {
      triggerToast('error', 'Too many requests. Please wait a moment.', 6000);
      return Promise.reject(error);
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

        if (refreshResponse.status === 200) {
          // Cookies are automatically set by the browser from Set-Cookie headers
          // Retry original request
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh token failed/expired
        if (!(import.meta.env.DEV && localStorage.getItem('mockSession'))) {
          if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(refreshError);
      }
    }

    // If _retry is true and we still got 401 -> redirect to login (prevent infinite loop)
    if (error.response?.status === 401 && originalRequest._retry) {
      if (!(import.meta.env.DEV && localStorage.getItem('mockSession'))) {
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
