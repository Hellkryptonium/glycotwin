import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { PatientProfileRepository } from '../patients/patients.repository.js';

export const getPatientProfileToolSchema = z.object({
  patientProfileId: z.string().uuid('Patient profile ID must be a valid UUID'),
}).strict();

export type GetPatientProfileToolInput = z.infer<typeof getPatientProfileToolSchema>;
const authenticatedDoctorUserIdSchema = z.string().uuid('Authenticated doctor user ID must be a valid UUID');

export interface PatientProfileForAgent {
  id: string;
  fullName: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  diabetesType: string | null;
}

export interface DoctorProfileRepository {
  findByUserId(userId: string): Promise<{
    id: string;
    userId: string;
    verificationStatus: 'pending' | 'verified' | 'rejected';
  } | null>;
}

export interface GetPatientProfileTool {
  getPatientProfile(
    authenticatedDoctorUserId: string,
    patientProfileId: string,
  ): Promise<PatientProfileForAgent>;
}

export function createGetPatientProfileTool(
  patientRepository: PatientProfileRepository,
  doctorRepository: DoctorProfileRepository,
  getCurrentUser: (userId: string) => Promise<AuthenticatedUser>,
): GetPatientProfileTool {
  return {
    async getPatientProfile(authenticatedDoctorUserId: string, patientProfileId: string) {
      const trustedDoctorUserId = authenticatedDoctorUserIdSchema.parse(authenticatedDoctorUserId);
      const input = getPatientProfileToolSchema.parse({ patientProfileId });

      const doctor = await getCurrentUser(trustedDoctorUserId);
      if (!doctor.isActive) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
      }
      if (doctor.role !== 'doctor') {
        throw new AppError(403, 'FORBIDDEN', 'You do not have permission to access this resource.');
      }

      const doctorProfile = await doctorRepository.findByUserId(trustedDoctorUserId);
      if (!doctorProfile || doctorProfile.verificationStatus !== 'verified') {
        throw new AppError(403, 'DOCTOR_VERIFICATION_REQUIRED', 'A verified doctor account is required.');
      }

      const patientProfile = await patientRepository.findForDoctor(
        input.patientProfileId,
        doctorProfile.id,
      );
      if (!patientProfile) {
        throw new AppError(403, 'PATIENT_RELATIONSHIP_REQUIRED', 'An active patient relationship is required.');
      }

      return {
        id: patientProfile.id,
        fullName: patientProfile.fullName,
        dateOfBirth: patientProfile.dateOfBirth,
        gender: patientProfile.gender,
        diabetesType: patientProfile.diabetesType,
      };
    },
  };
}
