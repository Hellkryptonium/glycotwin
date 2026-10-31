import { api } from './api';
import type { ApiResponse, ConnectionPage, GlucosePage, PatientProfileResponse, PatientSearchResult } from '../types/api';

export async function searchPatients(email: string) {
  const response = await api.get<ApiResponse<PatientSearchResult>>('/doctor/patients/search', { params: { email } });
  return response.data.data;
}

export async function getConnectedPatients(page = 1, limit = 20) {
  const response = await api.get<ApiResponse<ConnectionPage>>('/doctor/patients', { params: { page, limit } });
  return response.data.data;
}

export async function getPatientProfile(patientId: string) {
  const response = await api.get<ApiResponse<PatientProfileResponse>>(`/doctor/patients/${patientId}/profile`);
  return response.data.data;
}

export async function getPatientGlucoseReadings(patientId: string, filters: { page: number; limit: number; from?: string; to?: string; context?: string }) {
  const response = await api.get<ApiResponse<GlucosePage>>(`/doctor/patients/${patientId}/glucose-readings`, { params: filters });
  return response.data.data;
}
