import { describe, expect, it } from 'vitest';
import { createLifestyleService } from '../src/modules/lifestyle/lifestyle.service.js';
import type { AuthenticatedUser } from '../src/modules/auth/auth.types.js';
import type { LifestyleInput } from '../src/modules/lifestyle/lifestyle.schema.js';

const patientId = '00000000-0000-4000-8000-000000000013';
const doctorProfileId = '00000000-0000-4000-8000-000000000011';
const otherPatientId = '00000000-0000-4000-8000-000000000014';

function user(role: 'patient' | 'doctor', id = 'user'): AuthenticatedUser {
  return {
    id, email: `${id}@example.com`, role, isActive: true, emailVerifiedAt: null, createdAt: new Date(), updatedAt: new Date(),
    ...(role === 'doctor'
      ? { doctorProfile: { id: doctorProfileId, fullName: 'Doctor', medicalRegistrationNumber: null, medicalCouncil: null, specialization: null, hospitalOrClinic: null, yearsOfExperience: null, verificationStatus: 'verified' } }
      : { patientProfile: { id: patientId, fullName: 'Patient', dateOfBirth: null, gender: null, diabetesType: null } }),
  };
}

const meal: LifestyleInput = { type: 'meal', mealType: 'breakfast', description: 'Oats', occurredAt: new Date('2026-01-01T08:00:00Z'), notes: null };

function harness() {
  const entries = [{ id: 'entry-1', patientId, ...meal }];
  const repository = {
    findPatientByUserId: async (id: string) => ({ id: id === 'other' ? otherPatientId : patientId }),
    findPatientForDoctor: async (target: string) => target === patientId ? { patientId: target } : null,
    create: async (target: string, input: LifestyleInput) => ({ id: 'new', patientId: target, ...input }),
    list: async (target: string) => entries.filter((entry) => entry.patientId === target),
    findById: async (id: string) => entries.find((entry) => entry.id === id) ?? null,
    update: async (id: string, target: string, input: LifestyleInput) => {
      const entry = entries.find((candidate) => candidate.id === id && candidate.patientId === target);
      return entry ? { ...entry, ...input } : null;
    },
    remove: async (id: string, target: string) => entries.some((entry) => entry.id === id && entry.patientId === target) ? { id } : null,
  };
  const service = createLifestyleService(repository, async (id) => user(id === 'doctor' ? 'doctor' : 'patient', id));
  return { service };
}

describe('lifestyle tracking', () => {
  it('creates and lists patient-owned entries', async () => {
    const { service } = harness();
    await expect(service.create('patient', meal)).resolves.toMatchObject({ type: 'meal' });
    await expect(service.listOwn('patient', { page: 1, limit: 20 })).resolves.toMatchObject({ items: [{ patientId }] });
  });

  it('prevents cross-patient reads and requires active doctor relationships', async () => {
    const { service } = harness();
    await expect(service.getOwn('other', 'entry-1')).rejects.toMatchObject({ code: 'LIFESTYLE_ENTRY_NOT_FOUND' });
    await expect(service.listForDoctor('doctor', otherPatientId, { page: 1, limit: 20 })).rejects.toMatchObject({ code: 'PATIENT_RELATIONSHIP_REQUIRED' });
  });
});
