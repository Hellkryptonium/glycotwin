import { AppError } from '../../common/errors/app-error.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { LifestyleInput, LifestyleListInput } from './lifestyle.schema.js';

export function createLifestyleService(
  repository: ReturnType<typeof import('./lifestyle.repository.js').createLifestyleRepository>,
  getCurrentUser: (userId: string) => Promise<AuthenticatedUser>,
) {
  async function patient(userId: string) {
    const user = await getCurrentUser(userId);
    if (user.role !== 'patient') throw new AppError(403, 'FORBIDDEN', 'You do not have permission to access this resource.');
    const profile = await repository.findPatientByUserId(user.id);
    if (!profile) throw new AppError(404, 'PATIENT_PROFILE_NOT_FOUND', 'Patient profile was not found.');
    return profile.id;
  }
  async function doctor(userId: string) {
    const user = await getCurrentUser(userId);
    if (user.role !== 'doctor' || user.doctorProfile?.verificationStatus !== 'verified') throw new AppError(403, 'DOCTOR_VERIFICATION_REQUIRED', 'A verified doctor account is required.');
    return user.doctorProfile.id;
  }
  return {
    async create(userId: string, input: LifestyleInput) { return repository.create(await patient(userId), input); },
    async listOwn(userId: string, input: LifestyleListInput) { return { items: await repository.list(await patient(userId), input), page: input.page, limit: input.limit }; },
    async getOwn(userId: string, id: string) {
      const entry = await repository.findById(id);
      if (!entry || entry.patientId !== await patient(userId)) throw new AppError(404, 'LIFESTYLE_ENTRY_NOT_FOUND', 'Lifestyle entry was not found.');
      return entry;
    },
    async update(userId: string, id: string, input: LifestyleInput) {
      const entry = await repository.update(id, await patient(userId), input);
      if (!entry) throw new AppError(404, 'LIFESTYLE_ENTRY_NOT_FOUND', 'Lifestyle entry was not found.');
      return entry;
    },
    async remove(userId: string, id: string) {
      if (!await repository.remove(id, await patient(userId))) throw new AppError(404, 'LIFESTYLE_ENTRY_NOT_FOUND', 'Lifestyle entry was not found.');
    },
    async listForDoctor(userId: string, patientId: string, input: LifestyleListInput) {
      if (!await repository.findPatientForDoctor(patientId, await doctor(userId))) throw new AppError(403, 'PATIENT_RELATIONSHIP_REQUIRED', 'An active patient relationship is required.');
      return { items: await repository.list(patientId, input), page: input.page, limit: input.limit };
    },
  };
}
