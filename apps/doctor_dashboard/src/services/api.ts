import axios, { AxiosError } from 'axios';
import { useAuthStore } from '../stores/auth.store';
import type { ApiErrorShape, ApiResponse, BrowserSession } from '../types/api';

const configuration = {
  baseURL: '/backend',
  headers: { 'Content-Type': 'application/json', 'X-GlycoTwin-Client': 'web' },
  timeout: 12000,
};

export const browserAuth = axios.create(configuration);
export const api = axios.create(configuration);

let refreshInFlight: Promise<BrowserSession> | null = null;
let sessionChannel: BroadcastChannel | null = null;

export function subscribeToSessionChanges(onChange: () => void) {
  if (typeof BroadcastChannel === 'undefined') return undefined;
  const channel = new BroadcastChannel('glycotwin-session');
  sessionChannel = channel;
  channel.onmessage = (event) => { if (event.data === 'changed') onChange(); };
  return () => {
    channel.close();
    if (sessionChannel === channel) sessionChannel = null;
  };
}

export function notifySessionChanged() {
  sessionChannel?.postMessage('changed');
}

export async function withSessionLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return await navigator.locks.request('glycotwin-browser-session', operation);
  }
  return operation();
}

export function refreshBrowserSession(): Promise<BrowserSession> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = withSessionLock(async () => {
    try {
      const request = () => browserAuth.post<ApiResponse<BrowserSession>>('/auth/refresh', {});
      const response = await request().catch(async (error: unknown) => {
        if (!axios.isAxiosError(error) || error.response?.status !== 409 || error.response.data?.error?.code !== 'REFRESH_ALREADY_ROTATED') throw error;
        // Browsers without Web Locks can briefly race the same cookie across tabs.
        await new Promise((resolve) => setTimeout(resolve, 150));
        return request();
      });
      const session = response.data.data;
      useAuthStore.getState().setSession(session);
      return session;
    } catch (error) {
      const store = useAuthStore.getState();
      if (axios.isAxiosError(error) && error.response?.status === 401) store.clear();
      else store.markUnavailable();
      throw error;
    }
  }).finally(() => { refreshInFlight = null; });

  return refreshInFlight;
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

api.interceptors.response.use(undefined, async (error: unknown) => {
  if (!axios.isAxiosError(error) || error.response?.status !== 401 || !error.config) throw error;

  const config: typeof error.config & { sessionRetried?: boolean } = error.config;
  const tokenAtRequest = config.headers.get('Authorization');
  const currentToken = useAuthStore.getState().accessToken;
  // A failed password check is an account form error, not an expired access token.
  const credentialError = ['INVALID_CREDENTIALS', 'INCORRECT_CURRENT_PASSWORD'].includes(error.response.data?.error?.code);
  if (!tokenAtRequest || !currentToken || config.sessionRetried || credentialError) throw error;

  config.sessionRetried = true;
  if (tokenAtRequest === `Bearer ${currentToken}`) await refreshBrowserSession();
  return api.request(config);
});

export function normalizeApiError(error: unknown): ApiErrorShape {
  if (axios.isAxiosError(error) && error.response?.data?.error) {
    return { ...error.response.data.error as ApiErrorShape, status: error.response.status };
  }
  if (error instanceof AxiosError) {
    return { code: 'NETWORK_ERROR', message: 'The service is unavailable. Try again shortly.', status: error.response?.status };
  }
  return { code: 'UNKNOWN_ERROR', message: 'Something unexpected happened. Try again.' };
}
