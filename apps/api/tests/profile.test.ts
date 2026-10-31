import { describe, expect, it } from 'vitest';
import { AppError } from '../src/common/errors/app-error.js';
import type { AuthenticatedUser } from '../src/modules/auth/auth.types.js';
import type { PatientProfileRepository } from '../src/modules/patients/patients.repository.js';
import { createPatientProfileService } from '../src/modules/patients/profile.service.js';
import { updatePatientProfileSchema } from '../src/modules/patients/profile.schema.js';

const doctorUserId = '00000000-0000-4000-8000-000000000001';
const secondDoctorUserId = '00000000-0000-4000-8000-000000000002';
const patientUserId = '00000000-0000-4000-8000-000000000003';
const patientProfileId = '00000000-0000-4000-8000-000000000013';

const patientProfile = (fullName: string | null = null) => ({
  id: patientProfileId,
  userId: patientUserId,
  fullName,
  dateOfBirth: null,
  gender: null,
  diabetesType: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

function user(id: string, role: 'doctor' | 'patient', verified = false): AuthenticatedUser {
  return {
    id,
    email: `${id.slice(-2)}@example.com`,
    role,
    isActive: true,
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...(role === 'doctor' ? {
      doctorProfile: {
        id: id === doctorUserId ? '00000000-0000-4000-8000-000000000011' : '00000000-0000-4000-8000-000000000012',
        fullName: 'Doctor',
        medicalRegistrationNumber: null,
        medicalCouncil: null,
        specialization: null,
        hospitalOrClinic: null,
        yearsOfExperience: null,
        verificationStatus: verified ? 'verified' : 'pending',
      },
    } : { patientProfile: { id: patientProfileId, fullName: null, dateOfBirth: null, gender: null, diabetesType: null } }),
  };
}

function createHarness() {
  let profile = patientProfile();
  const users = new Map([
    [doctorUserId, user(doctorUserId, 'doctor', true)],
    [secondDoctorUserId, user(secondDoctorUserId, 'doctor', true)],
    [patientUserId, user(patientUserId, 'patient')],
  ]);
  const repository: PatientProfileRepository = {
    async insertProfile() { return profile; },
    async findByUserId(userId) { return userId === patientUserId ? profile : null; },
    async findForDoctor(patientId, doctorId) {
      return patientId === patientProfileId && doctorId === '00000000-0000-4000-8000-000000000011' ? profile : null;
    },
    async updateProfile(userId, input) {
      if (userId !== patientUserId) return null;
      profile = { ...profile, ...input, updatedAt: new Date() };
      return profile;
    },
  };
  const service = createPatientProfileService(repository, async (id) => {
    const current = users.get(id);
    if (!current) throw new Error('missing user');
    return current;
  });
  return { service, getProfile: () => profile };
}

describe('patient profiles', () => {
  it('creates and returns the patient-owned profile', async () => {
    const harness = createHarness();
    const result = await harness.service.updateOwnProfile(patientUserId, updatePatientProfileSchema.parse({
      fullName: 'Asha Patient',
      dateOfBirth: '1990-05-10',
      gender: 'female',
      diabetesType: 'type 2',
    }));
    expect(result.email).toBe('03@example.com');
    expect(result.profile.fullName).toBe('Asha Patient');
    expect(harness.getProfile().dateOfBirth).toEqual(new Date('1990-05-10T00:00:00.000Z'));
  });

  it('returns incomplete profiles without fabricating fields', async () => {
    const harness = createHarness();
    const result = await harness.service.getOwnProfile(patientUserId);
    expect(result.profile).toMatchObject({ fullName: null, dateOfBirth: null, gender: null, diabetesType: null });
  });

  it('allows only an actively connected doctor to read the profile', async () => {
    const harness = createHarness();
    await expect(harness.service.getForDoctor(doctorUserId, patientProfileId)).resolves.toMatchObject({
      email: '03@example.com',
      profile: { id: patientProfileId },
    });
    await expect(harness.service.getForDoctor(secondDoctorUserId, patientProfileId)).rejects.toMatchObject<AppError>({
      code: 'PATIENT_RELATIONSHIP_REQUIRED',
      statusCode: 403,
    });
  });

  it('rejects future dates and missing names', () => {
    expect(() => updatePatientProfileSchema.parse({ fullName: '', dateOfBirth: null })).toThrow();
    expect(() => updatePatientProfileSchema.parse({ fullName: 'Patient', dateOfBirth: '2999-01-01' })).toThrow();
  });
});
