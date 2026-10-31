import { AppError } from '../../common/errors/app-error.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { GlucoseListInput, GlucoseReadingInput } from './glucose.schema.js';

export function createGlucoseService(
  repository: ReturnType<typeof import('./glucose.repository.js').createGlucoseRepository>,
  getCurrentUser: (userId: string) => Promise<AuthenticatedUser>,
) {
  async function patientProfile(userId: string) {
    const user = await getCurrentUser(userId);
    if (user.role !== 'patient') throw new AppError(403, 'FORBIDDEN', 'You do not have permission to access this resource.');
    const profile = await repository.findPatientByUserId(user.id);
    if (!profile) throw new AppError(404, 'PATIENT_PROFILE_NOT_FOUND', 'Patient profile was not found.');
    return { user, profile };
  }

  async function verifiedDoctor(userId: string) {
    const user = await getCurrentUser(userId);
    if (user.role !== 'doctor' || user.doctorProfile?.verificationStatus !== 'verified') {
      throw new AppError(403, 'DOCTOR_VERIFICATION_REQUIRED', 'A verified doctor account is required.');
    }
    return { user, profileId: user.doctorProfile.id };
  }

  async function readForPatient(patientId: string, input: GlucoseListInput) {
    return {
      items: await repository.list(patientId, input),
      page: input.page,
      limit: input.limit,
    };
  }

  return {
    async create(userId: string, input: GlucoseReadingInput) {
      const { user, profile } = await patientProfile(userId);
      return repository.create(profile.id, user.id, { ...input, notes: input.notes ?? null });
    },

    async listOwn(userId: string, input: GlucoseListInput) {
      const { profile } = await patientProfile(userId);
      return readForPatient(profile.id, input);
    },

    async getOwn(userId: string, id: string) {
      const { profile } = await patientProfile(userId);
      const reading = await repository.findById(id);
      if (!reading || reading.patientId !== profile.id) throw new AppError(404, 'GLUCOSE_READING_NOT_FOUND', 'Glucose reading was not found.');
      return reading;
    },

    async update(userId: string, id: string, input: GlucoseReadingInput) {
      const { user, profile } = await patientProfile(userId);
      const reading = await repository.update(id, profile.id, user.id, { ...input, notes: input.notes ?? null });
      if (!reading) throw new AppError(404, 'GLUCOSE_READING_NOT_FOUND', 'Glucose reading was not found.');
      return reading;
    },

    async remove(userId: string, id: string) {
      const { user, profile } = await patientProfile(userId);
      const reading = await repository.remove(id, profile.id, user.id);
      if (!reading) throw new AppError(404, 'GLUCOSE_READING_NOT_FOUND', 'Glucose reading was not found.');
    },

    async listForDoctor(userId: string, patientId: string, input: GlucoseListInput) {
      const { profileId } = await verifiedDoctor(userId);
      if (!await repository.findPatientForDoctor(patientId, profileId)) {
        throw new AppError(403, 'PATIENT_RELATIONSHIP_REQUIRED', 'An active patient relationship is required.');
      }
      return readForPatient(patientId, input);
    },
  };
}
