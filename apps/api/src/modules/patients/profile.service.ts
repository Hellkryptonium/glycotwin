import { AppError } from '../../common/errors/app-error.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { PatientProfileRepository } from './patients.repository.js';
import type { UpdatePatientProfileInput } from './profile.schema.js';

function toProfile(profile: {
  id: string;
  fullName: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  diabetesType: string | null;
}) {
  return {
    id: profile.id,
    fullName: profile.fullName,
    dateOfBirth: profile.dateOfBirth,
    gender: profile.gender,
    diabetesType: profile.diabetesType,
  };
}

export function createPatientProfileService(
  repository: PatientProfileRepository,
  getCurrentUser: (userId: string) => Promise<AuthenticatedUser>,
) {
  async function requirePatient(userId: string) {
    const user = await getCurrentUser(userId);
    if (user.role !== 'patient') throw new AppError(403, 'FORBIDDEN', 'You do not have permission to access this resource.');
    const profile = await repository.findByUserId(user.id);
    if (!profile) throw new AppError(404, 'PATIENT_PROFILE_NOT_FOUND', 'Patient profile was not found.');
    return { user, profile };
  }

  return {
    async getOwnProfile(userId: string) {
      const { user, profile } = await requirePatient(userId);
      return { email: user.email, profile: toProfile(profile) };
    },

    async updateOwnProfile(userId: string, input: UpdatePatientProfileInput) {
      const { user } = await requirePatient(userId);
      const profile = await repository.updateProfile(user.id, {
        fullName: input.fullName,
        dateOfBirth: input.dateOfBirth ? new Date(`${input.dateOfBirth}T00:00:00.000Z`) : null,
        gender: input.gender ?? null,
        diabetesType: input.diabetesType ?? null,
      });
      if (!profile) throw new AppError(404, 'PATIENT_PROFILE_NOT_FOUND', 'Patient profile was not found.');
      return { email: user.email, profile: toProfile(profile) };
    },

    async getForDoctor(userId: string, patientId: string) {
      const doctor = await getCurrentUser(userId);
      if (doctor.role !== 'doctor' || doctor.doctorProfile?.verificationStatus !== 'verified') {
        throw new AppError(403, 'DOCTOR_VERIFICATION_REQUIRED', 'A verified doctor account is required.');
      }
      const profile = await repository.findForDoctor(patientId, doctor.doctorProfile.id);
      if (!profile) throw new AppError(403, 'PATIENT_RELATIONSHIP_REQUIRED', 'An active patient relationship is required.');
      return { email: (await getPatientEmail(profile.userId)), profile: toProfile(profile) };
    },
  };

  async function getPatientEmail(userId: string): Promise<string> {
    const user = await getCurrentUser(userId);
    return user.email;
  }
}
