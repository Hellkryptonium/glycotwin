import { describe, expect, it } from 'vitest';
import { createMedicationService } from '../src/modules/medications/medication.service.js';
import type { AuthenticatedUser } from '../src/modules/auth/auth.types.js';
import type { MedicationInput } from '../src/modules/medications/medication.schema.js';

const patientId = '00000000-0000-4000-8000-000000000013';
const otherPatientId = '00000000-0000-4000-8000-000000000014';
const doctorProfileId = '00000000-0000-4000-8000-000000000011';
const medicationId = '00000000-0000-4000-8000-000000000021';

function user(role: 'patient' | 'doctor', id = 'patient'): AuthenticatedUser {
  return {
    id, email: `${id}@example.com`, role, isActive: true, emailVerifiedAt: null, createdAt: new Date(), updatedAt: new Date(),
    ...(role === 'doctor'
      ? { doctorProfile: { id: doctorProfileId, fullName: 'Doctor', medicalRegistrationNumber: null, medicalCouncil: null, specialization: null, hospitalOrClinic: null, yearsOfExperience: null, verificationStatus: 'verified' } }
      : { patientProfile: { id: patientId, fullName: 'Patient', dateOfBirth: null, gender: null, diabetesType: null } }),
  };
}

const input: MedicationInput = {
  name: 'Metformin',
  dosage: '500 mg',
  frequency: 'Twice daily',
  scheduleTimes: ['08:00', '20:00'],
  startDate: new Date('2026-01-01T00:00:00Z'),
  endDate: null,
  instructions: 'Take with food',
};

function harness() {
  const medication = { id: medicationId, patientId, status: 'active' as const, ...input };
  const repository = {
    findPatientByUserId: async (id: string) => ({ id: id === 'other' ? otherPatientId : patientId }),
    findPatientForDoctor: async (target: string) => target === patientId ? { patientId: target } : null,
    create: async () => medication,
    list: async () => [medication],
    findById: async (id: string) => id === medicationId ? medication : null,
    update: async () => medication,
    discontinue: async () => ({ ...medication, status: 'discontinued' as const }),
    remove: async () => medication,
    listDoses: async () => [],
    createDose: async (_id: string, _patientId: string, _actor: string, dose: unknown) => ({ id: 'dose-1', ...dose }),
    updateDose: async () => ({ id: 'dose-1' }),
    doseStats: async () => [{ status: 'taken', count: 1 }],
  };
  return createMedicationService(repository, async (id) => user(id === 'doctor' ? 'doctor' : 'patient', id));
}

describe('medication tracking', () => {
  it('allows patients to create, discontinue, and record doses', async () => {
    const service = harness();
    await expect(service.create('patient', input)).resolves.toMatchObject({ name: 'Metformin' });
    await expect(service.discontinue('patient', medicationId)).resolves.toMatchObject({ status: 'discontinued' });
    await expect(service.createDose('patient', medicationId, { scheduledAt: new Date(), takenAt: new Date(), status: 'taken' })).resolves.toMatchObject({ status: 'taken' });
  });

  it('enforces ownership and active doctor relationships', async () => {
    const service = harness();
    await expect(service.getOwn('other', medicationId)).rejects.toMatchObject({ code: 'MEDICATION_NOT_FOUND' });
    await expect(service.doctorMedications('doctor', otherPatientId, { status: 'active', page: 1, limit: 20 })).rejects.toMatchObject({ code: 'PATIENT_RELATIONSHIP_REQUIRED' });
  });
});
