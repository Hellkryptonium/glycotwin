import { api } from './api';
import type { ApiResponse } from '../types/api';

export async function createInvitation(patientId: string) {
  const response = await api.post<ApiResponse<{ id: string; status: string; expiresAt: string; createdAt: string }>>('/doctor/invitations', { patientId });
  return response.data.data;
}
