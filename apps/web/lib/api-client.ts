/**
 * Axios API client — the single configured instance for all authenticated
 * client-side API calls. Server Components call the backend directly via fetch.
 *
 * Features:
 * - Attaches JWT access token from Zustand (in-memory only)
 * - Attaches X-Tenant-ID header when a tenant is active
 * - Handles 401 by attempting a token refresh via the HttpOnly cookie
 * - Handles refresh failure by clearing auth state. Route guards handle redirects.
 */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL =
  typeof window !== 'undefined'
    ? (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000')
    : (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000');

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  withCredentials: true, // send HttpOnly refresh token cookie
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30_000,
});

// Request interceptor — attach access token and tenant ID
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Dynamically import stores to avoid circular deps
    // Access token is in Zustand memory only — never localStorage
    if (typeof window !== 'undefined') {
      try {
        // Dynamic import to avoid SSR issues
        const { useAuthStore } = require('@/stores/auth.store') as {
          useAuthStore: { getState: () => { accessToken: string | null; tenantId: string | null } };
        };
        const state = useAuthStore.getState();

        if (state.accessToken) {
          config.headers['Authorization'] = `Bearer ${state.accessToken}`;
        }

        if (state.tenantId) {
          config.headers['X-Tenant-ID'] = state.tenantId;
        }
      } catch {
        // Store not initialized yet — proceed without token
      }
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Track whether we are already refreshing to prevent loops
let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  refreshQueue.forEach((item) => {
    if (error) {
      item.reject(error);
    } else if (token) {
      item.resolve(token);
    }
  });
  refreshQueue = [];
};

// Response interceptor — handle 401 with token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    const requestUrl = originalRequest.url ?? '';
    // Never attempt a silent refresh on auth endpoints — they are authentication
    // initiation calls (nonce, verify, logout), not protected resource requests.
    // Retrying them with a refresh token makes no sense and hides the real error.
    const isAuthRoute = requestUrl.includes('/auth/');

    if (error.response?.status === 401 && !originalRequest['_retry'] && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch(Promise.reject.bind(Promise));
      }

      originalRequest['_retry'] = true;
      isRefreshing = true;

      try {
        // Refresh token is in an HttpOnly cookie — just POST to refresh endpoint
        const refreshResponse = await axios.post<{
          accessToken: string;
          user?: {
            id: string;
            walletAddress: string;
            isPlatformAdmin: boolean;
          };
        }>(
          `${API_BASE_URL}/api/v1/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newToken = refreshResponse.data.accessToken;

        // Update the in-memory store
        if (typeof window !== 'undefined') {
          try {
            const { useAuthStore } = require('@/stores/auth.store') as {
              useAuthStore: {
                getState: () => {
                  setAuth: (params: {
                    walletAddress: string;
                    accessToken: string;
                    userId: string;
                    isPlatformAdmin: boolean;
                  }) => void;
                  updateAccessToken: (token: string) => void;
                };
              };
            };
            const store = useAuthStore.getState();
            const user = refreshResponse.data.user;
            if (user) {
              store.setAuth({
                walletAddress: user.walletAddress,
                accessToken: newToken,
                userId: user.id,
                isPlatformAdmin: user.isPlatformAdmin,
              });
            } else {
              // Store only the access token — refresh token stays in the HttpOnly cookie
              store.updateAccessToken(newToken);
            }
          } catch {
            // Ignore store errors
          }
        }

        processQueue(null, newToken);
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);

        // Clear auth state. Protected route guards decide whether to redirect.
        if (typeof window !== 'undefined') {
          try {
            const currentPath = `${window.location.pathname}${window.location.search}`;
            if (!currentPath.startsWith('/auth') && currentPath !== '/') {
              window.localStorage.setItem('bondflow:return-after-auth', currentPath);
            }
            const { useAuthStore } = require('@/stores/auth.store') as {
              useAuthStore: { getState: () => { clearAuth: () => void } };
            };
            useAuthStore.getState().clearAuth();
          } catch {
            // Ignore
          }
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
