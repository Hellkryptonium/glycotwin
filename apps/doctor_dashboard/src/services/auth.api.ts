import { api } from './api';
import type { ApiResponse, SafeUser, Tokens } from '../types/api';

export async function login(input: { email: string; password: string }) {
  const response = await api.post<ApiResponse<Tokens>>('/auth/login', input);
  return response.data.data;
}

export async function registerDoctor(input: { email: string; password: string }) {
  const response = await api.post<ApiResponse<SafeUser>>('/auth/register/doctor', input);
  return response.data.data;
}

export async function getMe() {
  const response = await api.get<ApiResponse<SafeUser>>('/auth/me');
  return response.data.data;
}

export async function logout(refreshToken: string) {
  await api.post('/auth/logout', { refreshToken });
}

export async function refresh(refreshToken: string) {
  const response = await api.post<ApiResponse<Tokens>>('/auth/refresh', { refreshToken });
  return response.data.data;
}