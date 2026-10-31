import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getConnectedPatients, getPatientGlucoseReadings, getPatientProfile, searchPatients } from '../services/patients.api';
import { queryKeys } from './keys';
import { useAuthStore } from '../stores/auth.store';

export function useConnectedPatients(page = 1, limit = 20) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  return useQuery({ queryKey: queryKeys.connectedPatients(page, limit), queryFn: () => getConnectedPatients(page, limit), enabled: Boolean(accessToken && user?.role === 'doctor'), retry: false });
}

export function usePatientSearch(email: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  return useQuery({ queryKey: queryKeys.patientSearch(email), queryFn: () => searchPatients(email), enabled: Boolean(email.length > 0 && accessToken && user?.role === 'doctor'), retry: false });
}

export function usePatientProfile(patientId: string) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: queryKeys.patientProfile(patientId),
    queryFn: () => getPatientProfile(patientId),
    enabled: Boolean(patientId && accessToken && user?.role === 'doctor'),
    retry: false,
  });
}

export function usePatientGlucoseReadings(patientId: string, filters: { page: number; limit: number; from?: string; to?: string; context?: string }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: queryKeys.patientGlucose(patientId, filters),
    queryFn: () => getPatientGlucoseReadings(patientId, filters),
    enabled: Boolean(patientId && accessToken && user?.role === 'doctor'),
    retry: false,
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (patientId: string) => import('../services/invitations.api').then(({ createInvitation }) => createInvitation(patientId)), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.patients }); } });
}