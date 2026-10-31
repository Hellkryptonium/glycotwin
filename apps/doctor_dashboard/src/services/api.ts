import axios, { AxiosError } from 'axios';
import { useAuthStore } from '../stores/auth.store';
import type { ApiErrorShape } from '../types/api';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(undefined, (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    useAuthStore.getState().clear();
  }
  return Promise.reject(error);
});

export function normalizeApiError(error: unknown): ApiErrorShape {
  if (axios.isAxiosError(error) && error.response?.data?.error) {
    return { ...error.response.data.error as ApiErrorShape, status: error.response.status };
  }
  if (error instanceof AxiosError) {
    return { code: 'NETWORK_ERROR', message: 'The service is unavailable. Try again shortly.' };
  }
  return { code: 'UNKNOWN_ERROR', message: 'Something unexpected happened. Try again.' };
}