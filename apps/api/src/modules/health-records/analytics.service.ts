import { AppError } from '../../common/errors/app-error.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { AnalyticsInput } from './analytics.types.js';

export function createAnalyticsService(
  repository: ReturnType<typeof import('./analytics.repository.js').createAnalyticsRepository>,
  getCurrentUser: (userId: string) => Promise<AuthenticatedUser>,
  findPatientByUserId: (userId: string) => Promise<{ id: string } | null>,
  findPatientForDoctor: (patientId: string, doctorId: string) => Promise<{ patientId: string } | null>,
) {
  async function verifiedDoctor(userId: string) {
    const user = await getCurrentUser(userId);
    if (user.role !== 'doctor' || user.doctorProfile?.verificationStatus !== 'verified') {
      throw new AppError(403, 'DOCTOR_VERIFICATION_REQUIRED', 'A verified doctor account is required.');
    }
    return user.doctorProfile.id;
  }
  return {
    async own(userId: string, input: AnalyticsInput) {
      const user = await getCurrentUser(userId);
      if (user.role !== 'patient') throw new AppError(403, 'FORBIDDEN', 'You do not have permission to access this resource.');
      const profile = await findPatientByUserId(user.id);
      if (!profile) throw new AppError(404, 'PATIENT_PROFILE_NOT_FOUND', 'Patient profile was not found.');
      return repository.get(profile.id, input);
    },
    async forDoctor(userId: string, patientId: string, input: AnalyticsInput) {
      const doctorId = await verifiedDoctor(userId);
      if (!await findPatientForDoctor(patientId, doctorId)) {
        throw new AppError(403, 'PATIENT_RELATIONSHIP_REQUIRED', 'An active patient relationship is required.');
      }
      return repository.get(patientId, input);
    },
  };
}
