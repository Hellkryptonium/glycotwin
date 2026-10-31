import { describe, expect, it } from 'vitest';
import type { AuthenticatedUser } from '../src/modules/auth/auth.types.js';
import { createGlucoseService } from '../src/modules/health-records/glucose.service.js';
import { glucoseReadingInputSchema } from '../src/modules/health-records/glucose.schema.js';
import type { GlucoseListInput, GlucoseReading } from '../src/modules/health-records/glucose.types.js';

const doctorUserId = '00000000-0000-4000-8000-000000000001';
const otherDoctorUserId = '00000000-0000-4000-8000-000000000002';
const patientUserId = '00000000-0000-4000-8000-000000000003';
const otherPatientUserId = '00000000-0000-4000-8000-000000000004';
const doctorProfileId = '00000000-0000-4000-8000-000000000011';
const otherDoctorProfileId = '00000000-0000-4000-8000-000000000012';
const patientProfileId = '00000000-0000-4000-8000-000000000013';
const otherPatientProfileId = '00000000-0000-4000-8000-000000000014';

function user(id: string, role: 'doctor' | 'patient', profileId: string): AuthenticatedUser {
  return {
    id,
    email: `${id.slice(-2)}@example.com`,
    role,
    isActive: true,
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...(role === 'doctor'
      ? { doctorProfile: { id: profileId, fullName: 'Doctor', medicalRegistrationNumber: null, medicalCouncil: null, specialization: null, hospitalOrClinic: null, yearsOfExperience: null, verificationStatus: 'verified' } }
      : { patientProfile: { id: profileId, fullName: 'Patient', dateOfBirth: null, gender: null, diabetesType: null } }),
  };
}

function createHarness() {
  const users = new Map([
    [doctorUserId, user(doctorUserId, 'doctor', doctorProfileId)],
    [otherDoctorUserId, user(otherDoctorUserId, 'doctor', otherDoctorProfileId)],
    [patientUserId, user(patientUserId, 'patient', patientProfileId)],
    [otherPatientUserId, user(otherPatientUserId, 'patient', otherPatientProfileId)],
  ]);
  let sequence = 1;
  const readings: GlucoseReading[] = [];
  const repository = {
    async findPatientByUserId(userId: string) {
      return userId === patientUserId ? { id: patientProfileId } : userId === otherPatientUserId ? { id: otherPatientProfileId } : null;
    },
    async findPatientForDoctor(patientId: string, doctorId: string) {
      return patientId === patientProfileId && doctorId === doctorProfileId ? { patientId } : null;
    },
    async create(patientId: string, _actorUserId: string, input: Omit<GlucoseReading, 'id' | 'patientId' | 'source' | 'createdAt' | 'updatedAt'> & { notes: string | null }) {
      const reading: GlucoseReading = { ...input, id: `00000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`, patientId, source: 'MANUAL', createdAt: new Date(), updatedAt: new Date() };
      readings.push(reading);
      return reading;
    },
    async list(patientId: string, input: GlucoseListInput) {
      return readings.filter((reading) => reading.patientId === patientId)
        .filter((reading) => !input.context || reading.context === input.context)
        .filter((reading) => !input.from || reading.measuredAt >= input.from)
        .filter((reading) => !input.to || reading.measuredAt <= input.to)
        .slice((input.page - 1) * input.limit, input.page * input.limit);
    },
    async findById(id: string) { return readings.find((reading) => reading.id === id) ?? null; },
    async update(id: string, patientId: string, _actorUserId: string, input: Omit<GlucoseReading, 'id' | 'patientId' | 'source' | 'createdAt' | 'updatedAt'> & { notes: string | null }) {
      const index = readings.findIndex((reading) => reading.id === id && reading.patientId === patientId);
      if (index < 0) return null;
      readings[index] = { ...readings[index]!, ...input, updatedAt: new Date() };
      return readings[index]!;
    },
    async remove(id: string, patientId: string, _actorUserId: string) {
      const index = readings.findIndex((reading) => reading.id === id && reading.patientId === patientId);
      if (index < 0) return null;
      const [removed] = readings.splice(index, 1);
      return removed ? { id: removed.id } : null;
    },
  };
  const service = createGlucoseService(repository, async (id) => {
    const current = users.get(id);
    if (!current) throw new Error('missing user');
    return current;
  });
  return { service, readings };
}

const input = {
  value: '126.25',
  unit: 'mg/dL' as const,
  measuredAt: new Date(Date.now() - 60_000),
  context: 'FASTING' as const,
  notes: 'Before breakfast',
};

describe('glucose records', () => {
  it('creates, lists, updates, and deletes patient-owned manual readings', async () => {
    const harness = createHarness();
    const created = await harness.service.create(patientUserId, input);
    expect(created.value).toBe('126.25');
    expect((await harness.service.listOwn(patientUserId, { page: 1, limit: 20 })).items).toHaveLength(1);
    const updated = await harness.service.update(patientUserId, created.id, { ...input, value: '130.5' });
    expect(updated.value).toBe('130.5');
    await expect(harness.service.remove(patientUserId, created.id)).resolves.toBeUndefined();
    expect(harness.readings).toHaveLength(0);
  });

  it('does not expose another patient reading to the owner', async () => {
    const harness = createHarness();
    const created = await harness.service.create(patientUserId, input);
    await expect(harness.service.getOwn(otherPatientUserId, created.id)).rejects.toMatchObject({ code: 'GLUCOSE_READING_NOT_FOUND' });
  });

  it('allows only an actively connected doctor to list readings', async () => {
    const harness = createHarness();
    await harness.service.create(patientUserId, input);
    await expect(harness.service.listForDoctor(doctorUserId, patientProfileId, { page: 1, limit: 20 })).resolves.toMatchObject({ items: [{ value: '126.25' }] });
    await expect(harness.service.listForDoctor(otherDoctorUserId, patientProfileId, { page: 1, limit: 20 })).rejects.toMatchObject({ code: 'PATIENT_RELATIONSHIP_REQUIRED' });
  });

  it('rejects future timestamps and unsupported input values', () => {
    expect(() => glucoseReadingInputSchema.parse({ ...input, value: '0' })).toThrow();
    expect(() => glucoseReadingInputSchema.parse({ ...input, measuredAt: new Date(Date.now() + 60_000).toISOString() })).toThrow();
  });
});
