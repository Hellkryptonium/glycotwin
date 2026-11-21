import { api, browserAuth, withSessionLock } from './api';
import type { ApiResponse, BrowserSession, DoctorProfile, DoctorProfileUpdate, SafeUser } from '../types/api';

type Credentials = { email: string; password: string };

async function startSession(path: string, input: Credentials) {
  return withSessionLock(async () => {
    const response = await browserAuth.post<ApiResponse<BrowserSession>>(path, input);
    return response.data.data;
  });
}

export function login(input: Credentials) {
  return startSession('/auth/login', input);
}

export function registerDoctor(input: Credentials) {
  return startSession('/auth/register/doctor', input);
}

export async function getMe() {
  const response = await api.get<ApiResponse<SafeUser>>('/auth/me');
  return response.data.data;
}

export async function logout() {
  await withSessionLock(async () => { await browserAuth.post('/auth/logout', {}); });
}

export async function updateDoctorProfile(input: DoctorProfileUpdate) {
  const response = await api.put<ApiResponse<{ email: string; profile: DoctorProfile }>>('/doctor/profile', input);
  return response.data.data;
}

export async function changePassword(input: { currentPassword: string; newPassword: string }) {
  await api.put('/auth/account/password', input);
}

export async function deleteAccount(currentPassword: string) {
  await api.delete('/auth/account', { data: { currentPassword } });
}
