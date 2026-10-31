export const queryKeys = {
  auth: ['auth'] as const,
  me: ['auth', 'me'] as const,
  patients: ['patients'] as const,
  connectedPatients: (page: number, limit: number) => ['patients', 'connected', { page, limit }] as const,
  patientSearch: (email: string) => ['patients', 'search', email] as const,
  invitations: ['invitations'] as const,
};