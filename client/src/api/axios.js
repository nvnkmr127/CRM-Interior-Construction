import axios from 'axios';
import { setupMockInterceptor } from './mockInterceptor';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,  // send cookies
  headers: { 'Content-Type': 'application/json' },
});

setupMockInterceptor(api);

// Helper for triggering global toasts from outside React
const triggerToast = (type, message, duration = 4000) => {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { type, message, duration } }));
};

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb, errCb) => {
  refreshSubscribers.push({ cb, errCb });
};

const onRefreshed = (error = null) => {
  refreshSubscribers.forEach(({ cb, errCb }) => {
    if (error) errCb(error);
    else cb();
  });
  refreshSubscribers = [];
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

      if (!isRefreshing) {
        isRefreshing = true;

        try {
          // POST /auth/refresh (no auth header, relying on httpOnly cookie)
          const refreshResponse = await axios.post(
            `${api.defaults.baseURL}/auth/refresh`,
            {},
            { withCredentials: true }
          );

          if (refreshResponse.status === 200) {
            isRefreshing = false;
            onRefreshed(null);
            return api(originalRequest);
          }
        } catch (refreshError) {
          isRefreshing = false;
          onRefreshed(refreshError);
          // Refresh token failed/expired
          if (!(import.meta.env.DEV && localStorage.getItem('mockSession'))) {
            if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
              window.location.href = '/login';
            }
          }
          return Promise.reject(refreshError);
        }
      } else {
        // Queue this request while refresh is happening
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh(
            () => resolve(api(originalRequest)),
            (err) => reject(err)
          );
        });
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
