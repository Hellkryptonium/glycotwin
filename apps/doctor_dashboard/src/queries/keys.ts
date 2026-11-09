export const queryKeys = {
  auth: ['auth'] as const,
  me: ['auth', 'me'] as const,
  patients: ['patients'] as const,
  patientProfile: (patientId: string) => ['patients', patientId, 'profile'] as const,
  patientGlucose: (patientId: string, filters: object) => ['patients', patientId, 'glucose', filters] as const,
  patientAnalytics: (patientId: string, range: string) => ['patients', patientId, 'analytics', 'glucose', range] as const,
  patientLifestyle: (patientId: string, filters: object) => ['patients', patientId, 'lifestyle', filters] as const,
  connectedPatients: (page: number, limit: number) => ['patients', 'connected', { page, limit }] as const,
  patientSearch: (email: string) => ['patients', 'search', email] as const,
  invitations: ['invitations'] as const,
};