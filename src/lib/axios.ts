
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

const AUTH_ENDPOINTS = ['/api/login', '/api/register', '/api/forgot-password', '/api/reset-password'];

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url ?? '';
      const isAuthRequest = AUTH_ENDPOINTS.some((path) => requestUrl.includes(path));

      if (!isAuthRequest) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);


export default axiosInstance;
