import { AppError } from '../../common/errors/app-error.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { DoseInput, DoseListInput, MedicationInput, MedicationListInput } from './medication.schema.js';

export function createMedicationService(
  repository: ReturnType<typeof import('./medication.repository.js').createMedicationRepository>,
  getCurrentUser: (userId: string) => Promise<AuthenticatedUser>,
) {
  async function patient(userId: string) {
    const user = await getCurrentUser(userId);
    if (user.role !== 'patient' || !user.isActive) throw new AppError(403, 'FORBIDDEN', 'You do not have permission to access this resource.');
    const profile = await repository.findPatientByUserId(user.id);
    if (!profile) throw new AppError(404, 'PATIENT_PROFILE_NOT_FOUND', 'Patient profile was not found.');
    return { id: profile.id, userId: user.id };
  }
  async function doctor(userId: string) {
    const user = await getCurrentUser(userId);
    if (user.role !== 'doctor' || user.doctorProfile?.verificationStatus !== 'verified') throw new AppError(403, 'DOCTOR_VERIFICATION_REQUIRED', 'A verified doctor account is required.');
    return user.doctorProfile.id;
  }
  async function ownedMedication(id: string, patientId: string) {
    const medication = await repository.findById(id);
    if (!medication || medication.patientId !== patientId) throw new AppError(404, 'MEDICATION_NOT_FOUND', 'Medication was not found.');
    return medication;
  }
  return {
    async create(userId: string, input: MedicationInput) { const owner = await patient(userId); return repository.create(owner.id, owner.userId, input); },
    async listOwn(userId: string, input: MedicationListInput) { const owner = await patient(userId); return { items: await repository.list(owner.id, input), page: input.page, limit: input.limit }; },
    async getOwn(userId: string, id: string) { return ownedMedication(id, (await patient(userId)).id); },
    async update(userId: string, id: string, input: MedicationInput) { const owner = await patient(userId); await ownedMedication(id, owner.id); return repository.update(id, owner.id, owner.userId, input); },
    async discontinue(userId: string, id: string) { const owner = await patient(userId); await ownedMedication(id, owner.id); return repository.discontinue(id, owner.id, owner.userId); },
    async remove(userId: string, id: string) { const owner = await patient(userId); await ownedMedication(id, owner.id); await repository.remove(id, owner.id, owner.userId); },
    async listDoses(userId: string, id: string, input: DoseListInput) { const owner = await patient(userId); await ownedMedication(id, owner.id); return { items: await repository.listDoses(id, owner.id, input), page: input.page, limit: input.limit }; },
    async createDose(userId: string, id: string, input: DoseInput) { const owner = await patient(userId); const medication = await ownedMedication(id, owner.id); if (medication.status !== 'active') throw new AppError(409, 'MEDICATION_DISCONTINUED', 'Discontinued medications cannot receive new doses.'); return repository.createDose(id, owner.id, owner.userId, input); },
    async updateDose(userId: string, id: string, doseId: string, input: DoseInput) { const owner = await patient(userId); await ownedMedication(id, owner.id); return repository.updateDose(doseId, id, owner.id, owner.userId, input); },
    async doctorMedications(userId: string, patientId: string, input: MedicationListInput) { if (!await repository.findPatientForDoctor(patientId, await doctor(userId))) throw new AppError(403, 'PATIENT_RELATIONSHIP_REQUIRED', 'An active patient relationship is required.'); return { items: await repository.list(patientId, input), page: input.page, limit: input.limit }; },
    async doctorDoses(userId: string, patientId: string, medicationId: string, input: DoseListInput) { if (!await repository.findPatientForDoctor(patientId, await doctor(userId))) throw new AppError(403, 'PATIENT_RELATIONSHIP_REQUIRED', 'An active patient relationship is required.'); const medication = await repository.findById(medicationId); if (!medication || medication.patientId !== patientId) throw new AppError(404, 'MEDICATION_NOT_FOUND', 'Medication was not found.'); const stats = await repository.doseStats(medicationId, patientId); return { items: await repository.listDoses(medicationId, patientId, input), page: input.page, limit: input.limit, stats }; },
  };
}
