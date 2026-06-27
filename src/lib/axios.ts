
import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  // @ts-ignore - a temporary workaround for a type definition issue
  trailingSlash: false,
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Endpoints that must never trigger a forced logout redirect.
const AUTH_ENDPOINTS = ['/api/login', '/api/register', '/api/forgot-password', '/api/reset-password'];

// Module-level flag – prevents multiple simultaneous 401 responses (parallel requests) from
// each triggering an independent redirect/storage-clear cycle.
let logoutInProgress = false;

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url ?? '';
      const isAuthRequest = AUTH_ENDPOINTS.some((path) => requestUrl.includes(path));

      if (!isAuthRequest && !logoutInProgress) {
        logoutInProgress = true;

        localStorage.removeItem('authToken');
        localStorage.removeItem('user');

        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          // Check whether the user is currently on an active call.  If so, we must not do a
          // hard page redirect mid-call (that would disconnect Twilio WebRTC).  Instead we set
          // a flag so that AppClientLayout can redirect naturally once the call ends.
          const activeCallSession = sessionStorage.getItem('active_call_session');

          if (activeCallSession) {
            sessionStorage.setItem('pending_auth_logout', '1');
            console.warn('[Auth] Session expired during an active call – will redirect after call ends.');
          } else {
            window.location.href = '/login';
          }
        }

        // Reset the flag shortly after so that a genuine new login attempt isn't blocked.
        setTimeout(() => { logoutInProgress = false; }, 5_000);
      }
    }
    return Promise.reject(error);
  }
);


export default axiosInstance;
