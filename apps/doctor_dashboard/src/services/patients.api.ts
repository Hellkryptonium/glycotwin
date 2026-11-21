import { api } from './api';
import type { AnalyticsRange, ApiResponse, CareItem, CareItemInput, ConnectionPage, DoctorCareResponse, GlucoseAnalytics, GlucosePage, LifestylePage, MedicationDosePage, MedicationPage, PatientProfileResponse, PatientSearchResult, TimelineFilters, TimelinePage } from '../types/api';

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

export async function getPatientGlucoseAnalytics(patientId: string, range: AnalyticsRange) {
  const response = await api.get<ApiResponse<GlucoseAnalytics>>(`/doctor/patients/${patientId}/analytics/glucose`, { params: { range } });
  return response.data.data;
}

export async function getPatientLifestyle(patientId: string, filters: { page: number; limit: number; from?: string; to?: string }) {
  const response = await api.get<ApiResponse<LifestylePage>>(`/doctor/patients/${patientId}/lifestyle/timeline`, { params: filters });
  return response.data.data;
}

export async function getPatientTimeline(patientId: string, filters: TimelineFilters) {
  const response = await api.get<ApiResponse<TimelinePage>>(`/doctor/patients/${encodeURIComponent(patientId)}/timeline`, { params: filters });
  return response.data.data;
}

export async function getDoctorCare(patientId: string) {
  const response = await api.get<ApiResponse<DoctorCareResponse>>(`/doctor/patients/${encodeURIComponent(patientId)}/care`);
  return response.data.data;
}

export async function saveCareItem(patientId: string, input: CareItemInput, itemId?: string) {
  const collection = `/doctor/patients/${encodeURIComponent(patientId)}/care/items`;
  const response = itemId
    ? await api.put<ApiResponse<CareItem>>(`${collection}/${encodeURIComponent(itemId)}`, input)
    : await api.post<ApiResponse<CareItem>>(collection, input);
  return response.data.data;
}

export async function getPatientMedications(patientId: string, status: 'active' | 'discontinued' | 'all' = 'all') {
  const response = await api.get<ApiResponse<MedicationPage>>(`/doctor/patients/${patientId}/medications`, { params: { status, page: 1, limit: 100 } });
  return response.data.data;
}

export async function getPatientMedicationDoses(patientId: string, medicationId: string) {
  const response = await api.get<ApiResponse<MedicationDosePage>>(`/doctor/patients/${patientId}/medications/${medicationId}/doses`, { params: { page: 1, limit: 100 } });
  return response.data.data;
}
