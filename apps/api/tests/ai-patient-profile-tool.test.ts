import { describe, expect, it } from 'vitest';
import { AppError } from '../src/common/errors/app-error.js';
import type { AuthenticatedUser } from '../src/modules/auth/auth.types.js';
import {
  createGetPatientProfileTool,
  getPatientProfileToolSchema,
  type DoctorProfileRepository,
} from '../src/modules/ai/patient-profile.tool.js';
import type { PatientProfileRepository } from '../src/modules/patients/patients.repository.js';

const doctorUserId = '00000000-0000-4000-8000-000000000001';
const unverifiedDoctorUserId = '00000000-0000-4000-8000-000000000002';
const inactiveDoctorUserId = '00000000-0000-4000-8000-000000000003';
const patientProfileId = '00000000-0000-4000-8000-000000000013';
const unrelatedPatientProfileId = '00000000-0000-4000-8000-000000000014';
const doctorProfileId = '00000000-0000-4000-8000-000000000011';

const patientProfile = {
  id: patientProfileId,
  userId: '00000000-0000-4000-8000-000000000021',
  fullName: 'Asha Patient',
  dateOfBirth: new Date('1990-05-10T00:00:00.000Z'),
  gender: 'female',
  diabetesType: 'type 2',
  treatmentContext: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function doctorUser(
  id: string,
  verificationStatus: 'pending' | 'verified',
  isActive = true,
): AuthenticatedUser {
  return {
    id,
    email: `${id.slice(-2)}@example.com`,
    role: 'doctor',
    isActive,
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    doctorProfile: {
      id: doctorProfileId,
      fullName: 'Doctor',
      medicalRegistrationNumber: null,
      medicalCouncil: null,
      specialization: null,
      hospitalOrClinic: null,
      yearsOfExperience: null,
      verificationStatus,
    },
  };
}

function createHarness(options: {
  relationship?: boolean;
} = {}) {
  const {
    relationship = true,
  } = options;
  const authenticatedUserLookups: string[] = [];
  const doctorRepositoryLookups: string[] = [];
  const patientRelationshipLookups: Array<{ patientId: string; doctorId: string }> = [];

  const users = new Map<string, AuthenticatedUser>([
    [doctorUserId, doctorUser(doctorUserId, 'verified')],
    [unverifiedDoctorUserId, doctorUser(unverifiedDoctorUserId, 'pending')],
    [inactiveDoctorUserId, doctorUser(inactiveDoctorUserId, 'verified', false)],
  ]);

  const patientRepository: PatientProfileRepository = {
    async insertProfile() { return patientProfile; },
    async findByUserId() { return patientProfile; },
    async findForDoctor(patientId, doctorId) {
      patientRelationshipLookups.push({ patientId, doctorId });
      return relationship && patientId === patientProfileId && doctorId === doctorProfileId
        ? patientProfile
        : null;
    },
    async updateProfile() { return patientProfile; },
  };

  const doctorRepository: DoctorProfileRepository = {
    async findByUserId(userId) {
      doctorRepositoryLookups.push(userId);
      if (userId === doctorUserId) {
        return { id: doctorProfileId, userId, verificationStatus: 'verified' };
      }
      if (userId === unverifiedDoctorUserId) {
        return { id: doctorProfileId, userId, verificationStatus: 'pending' };
      }
      if (userId === inactiveDoctorUserId) {
        return { id: doctorProfileId, userId, verificationStatus: 'verified' };
      }
      return null;
    },
  };

  const tool = createGetPatientProfileTool(
    patientRepository,
    doctorRepository,
    async (userId) => {
      authenticatedUserLookups.push(userId);
      const user = users.get(userId);
      if (!user) throw new Error('missing user');
      return user;
    },
  );

  return {
    tool,
    authenticatedUserLookups,
    doctorRepositoryLookups,
    patientRelationshipLookups,
  };
}

describe('get_patient_profile tool', () => {
  it('allows a verified doctor to access a connected patient with a minimal DTO', async () => {
    const { tool } = createHarness();

    await expect(tool.getPatientProfile(doctorUserId, patientProfileId)).resolves.toEqual({
      id: patientProfileId,
      fullName: 'Asha Patient',
      dateOfBirth: new Date('1990-05-10T00:00:00.000Z'),
      gender: 'female',
      diabetesType: 'type 2',
    });
  });

  it('denies an unverified doctor', async () => {
    const { tool } = createHarness();

    await expect(tool.getPatientProfile(unverifiedDoctorUserId, patientProfileId))
      .rejects.toMatchObject<AppError>({
        code: 'DOCTOR_VERIFICATION_REQUIRED',
        statusCode: 403,
      });
  });

  it('denies an inactive doctor', async () => {
    const { tool } = createHarness();

    await expect(tool.getPatientProfile(inactiveDoctorUserId, patientProfileId))
      .rejects.toMatchObject<AppError>({
        code: 'UNAUTHORIZED',
        statusCode: 401,
      });
  });

  it('denies a doctor without an active patient relationship', async () => {
    const { tool } = createHarness({ relationship: false });

    await expect(tool.getPatientProfile(doctorUserId, unrelatedPatientProfileId))
      .rejects.toMatchObject<AppError>({
        code: 'PATIENT_RELATIONSHIP_REQUIRED',
        statusCode: 403,
      });
  });

  it('rejects invalid patient profile ID input', async () => {
    const { tool } = createHarness();

    await expect(tool.getPatientProfile(doctorUserId, 'not-a-uuid')).rejects.toBeInstanceOf(Error);
  });

  it('rejects doctorUserId in model-facing arguments', () => {
    expect(() => getPatientProfileToolSchema.parse({
      patientProfileId,
      doctorUserId: unverifiedDoctorUserId,
    })).toThrow();
  });

  it('uses the trusted backend doctor identity instead of a model-supplied identity', async () => {
    const harness = createHarness();
    const modelArguments = {
      patientProfileId,
      doctorUserId: unverifiedDoctorUserId,
    };

    expect(() => getPatientProfileToolSchema.parse(modelArguments)).toThrow();
    await expect(harness.tool.getPatientProfile(doctorUserId, modelArguments.patientProfileId))
      .resolves.toMatchObject({ id: patientProfileId });

    expect(harness.authenticatedUserLookups).toEqual([doctorUserId]);
    expect(harness.doctorRepositoryLookups).toEqual([doctorUserId]);
    expect(harness.patientRelationshipLookups).toEqual([{
      patientId: patientProfileId,
      doctorId: doctorProfileId,
    }]);
  });
});
