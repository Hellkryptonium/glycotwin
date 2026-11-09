import { describe, expect, it } from 'vitest';
import { createAnalyticsService } from '../src/modules/health-records/analytics.service.js';
import type { GlucoseAnalytics } from '../src/modules/health-records/analytics.types.js';
import type { AuthenticatedUser } from '../src/modules/auth/auth.types.js';

const patientId = '00000000-0000-4000-8000-000000000013';
const doctorId = '00000000-0000-4000-8000-000000000011';

function user(id: string, role: 'doctor' | 'patient'): AuthenticatedUser {
  return {
    id, email: `${id}@example.com`, role, isActive: true, emailVerifiedAt: null, createdAt: new Date(), updatedAt: new Date(),
    ...(role === 'doctor'
      ? { doctorProfile: { id: doctorId, fullName: 'Doctor', medicalRegistrationNumber: null, medicalCouncil: null, specialization: null, hospitalOrClinic: null, yearsOfExperience: null, verificationStatus: 'verified' } }
      : { patientProfile: { id: patientId, fullName: 'Patient', dateOfBirth: null, gender: null, diabetesType: null } }),
  };
}

function analytics(totalReadings: number): GlucoseAnalytics {
  return {
    range: '7d', from: new Date('2026-01-01T00:00:00Z'), to: new Date('2026-01-08T00:00:00Z'),
    unit: totalReadings ? 'mg/dL' : null, latest: null, totalReadings, average: totalReadings ? '120.0000' : null,
    minimum: totalReadings ? '90.0000' : null, maximum: totalReadings ? '150.0000' : null, daily: [], readings: [],
    byUnit: totalReadings ? [{ unit: 'mg/dL', totalReadings, average: '120.0000', minimum: '90.0000', maximum: '150.0000' }] : [],
  };
}

describe('glucose analytics authorization', () => {
  it('allows a patient to request their own empty analytics', async () => {
    const repository = { get: async () => analytics(0) };
    const service = createAnalyticsService(repository, async (id) => user(id, 'patient'), async () => ({ id: patientId }), async () => ({ patientId }));
    await expect(service.own('patient', { range: '7d' })).resolves.toMatchObject({ totalReadings: 0, average: null });
  });

  it('requires an active relationship for doctor analytics', async () => {
    const repository = { get: async () => analytics(2) };
    const service = createAnalyticsService(repository, async () => user('doctor', 'doctor'), async () => ({ id: patientId }), async () => null);
    await expect(service.forDoctor('doctor', patientId, { range: '30d' })).rejects.toMatchObject({ code: 'PATIENT_RELATIONSHIP_REQUIRED' });
  });

  it('rejects non-patient access to patient analytics', async () => {
    const repository = { get: async () => analytics(2) };
    const service = createAnalyticsService(repository, async () => user('doctor', 'doctor'), async () => ({ id: patientId }), async () => ({ patientId }));
    await expect(service.own('doctor', { range: '90d' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
