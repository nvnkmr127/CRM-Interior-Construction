import axios from 'axios';
import { setupMockInterceptor } from './mockInterceptor';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://crm-interior-construction-server.vercel.app/api' : '/api'),
  withCredentials: true,  // send cookies
  headers: { 'Content-Type': 'application/json' },
});

setupMockInterceptor(api);

// REQUEST interceptor: ensure Bearer token is attached if available in localStorage
api.interceptors.request.use(
  (config) => {
    const hasAuth = config.headers?.get 
      ? config.headers.get('Authorization') || config.headers.get('authorization')
      : (config.headers['Authorization'] || config.headers['authorization']);
      
    if (!hasAuth) {
      const storedToken = localStorage.getItem('accessToken');
      if (storedToken) {
        if (config.headers?.set) {
          config.headers.set('Authorization', `Bearer ${storedToken}`);
        } else {
          config.headers['Authorization'] = `Bearer ${storedToken}`;
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Helper for triggering global toasts from outside React
const triggerToast = (type, message, duration = 4000) => {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { type, message, duration } }));
};

let isRefreshing = false;
let hasRefreshFailed = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb, errCb) => {
  refreshSubscribers.push({ cb, errCb });
};

const onRefreshed = (error = null, token = null) => {
  refreshSubscribers.forEach(({ cb, errCb }) => {
    if (error) errCb(error);
    else cb(token);
  });
  refreshSubscribers = [];
};

// RESPONSE interceptor
api.interceptors.response.use(
  (response) => {
    if (response.config.url.includes('/auth/login') || response.config.url.includes('/auth/refresh')) {
      hasRefreshFailed = false;
    }
    return response;
  },
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
      const isTenantDeactivated = 
        error.response?.data?.error === 'TENANT_DEACTIVATED' || 
        error.response?.data?.code === 'TENANT_DEACTIVATED' ||
        error.response?.data?.message?.toLowerCase().includes('deactivated');

      if (isTenantDeactivated) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('mockSession');
        localStorage.removeItem('isAuthenticated');
        delete api.defaults.headers.common['Authorization'];
        triggerToast('error', error.response?.data?.message || 'This workspace has been deactivated. Please contact support.', 6000);
        window.dispatchEvent(new CustomEvent('app:logout'));
        return Promise.reject(error);
      }

      const isAuthEndpoint = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/register');
      const isPortalEndpoint = error.config?.url?.includes('/portal');
      if (!isAuthEndpoint && !isPortalEndpoint) {
        // Permission error — show toast
        triggerToast('error', 'You do not have permission to do that.', 6000);
      }
      return Promise.reject(error);
    }
    if (error.response.status === 429) {
      triggerToast('error', 'Too many requests. Please wait a moment.', 6000);
      return Promise.reject(error);
    }

    const originalRequest = error.config;

    // Check if the request is an auth endpoint or portal endpoint (do not attempt token refresh or staff logout for portal endpoints)
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/login') || 
                           originalRequest?.url?.includes('/auth/register') || 
                           originalRequest?.url?.includes('/auth/refresh') || 
                           originalRequest?.url?.includes('/auth/logout');
    const isPortalEndpoint = originalRequest?.url?.includes('/portal');

    if (isPortalEndpoint) {
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized for Staff / Admin CRM
    if (error.response.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (hasRefreshFailed || !localStorage.getItem('isAuthenticated')) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('mockSession');
        localStorage.removeItem('isAuthenticated');
        delete api.defaults.headers.common['Authorization'];
        window.dispatchEvent(new CustomEvent('app:logout'));
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;

        try {
          // POST /auth/refresh (sending body fallback + httpOnly cookie)
          const storedRefreshToken = localStorage.getItem('refreshToken');
          const refreshResponse = await axios.post(
            `${api.defaults.baseURL}/auth/refresh`,
            { refreshToken: storedRefreshToken || undefined },
            { withCredentials: true }
          );

          if (refreshResponse.status === 200) {
            isRefreshing = false;
            
            const resData = refreshResponse.data?.data || refreshResponse.data || {};
            const newAccessToken = resData.accessToken;
            const newRefreshToken = resData.refreshToken;

            if (newAccessToken) {
              localStorage.setItem('accessToken', newAccessToken);
              api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
              originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
            }
            if (newRefreshToken) {
              localStorage.setItem('refreshToken', newRefreshToken);
            }

            onRefreshed(null, newAccessToken);
            return api(originalRequest);
          }
        } catch (refreshError) {
          isRefreshing = false;
          hasRefreshFailed = true;
          onRefreshed(refreshError);
          // Refresh token failed/expired
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('mockSession');
          localStorage.removeItem('isAuthenticated');
          delete api.defaults.headers.common['Authorization'];
          window.dispatchEvent(new CustomEvent('app:logout'));
          return Promise.reject(refreshError);
        }
      } else {
        // Queue this request while refresh is happening
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh(
            (token) => {
              if (token) {
                originalRequest.headers['Authorization'] = `Bearer ${token}`;
              } else {
                delete originalRequest.headers['Authorization'];
              }
              resolve(api(originalRequest));
            },
            (err) => reject(err)
          );
        });
      }
    }

    // If _retry is true and we still got 401 -> redirect to login (prevent infinite loop)
    if (error.response?.status === 401 && originalRequest._retry) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('mockSession');
      localStorage.removeItem('isAuthenticated');
      delete api.defaults.headers.common['Authorization'];
      window.dispatchEvent(new CustomEvent('app:logout'));
    }

    return Promise.reject(error);
  }
);

export default api;
