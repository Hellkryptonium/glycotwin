import { api } from './api';
import type { ApiResponse, ConnectionPage, PatientSearchResult } from '../types/api';

export async function searchPatients(email: string) {
  const response = await api.get<ApiResponse<PatientSearchResult>>('/doctor/patients/search', { params: { email } });
  return response.data.data;
}

export async function getConnectedPatients(page = 1, limit = 20) {
  const response = await api.get<ApiResponse<ConnectionPage>>('/doctor/patients', { params: { page, limit } });
  return response.data.data;
}
