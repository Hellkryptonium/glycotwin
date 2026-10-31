import { AppError } from '../../common/errors/app-error.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { ConnectionRepository } from './connection.types.js';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function mapConnectionError(error: unknown): never {
  if (error instanceof AppError) throw error;
  if (error instanceof Error) {
    if (error.message === 'PENDING_INVITATION_EXISTS') {
      throw new AppError(409, 'PENDING_INVITATION_EXISTS', 'A pending invitation already exists.');
    }
    if (error.message === 'INVITATION_NOT_FOUND') {
      throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation was not found.');
    }
    if (error.message === 'INVITATION_NOT_PENDING') {
      throw new AppError(409, 'INVITATION_NOT_PENDING', 'Invitation has already been resolved.');
    }
    if (error.message === 'INVITATION_EXPIRED') {
      throw new AppError(409, 'INVITATION_EXPIRED', 'Invitation has expired.');
    }
    if (error.message === 'RELATIONSHIP_EXISTS') {
      throw new AppError(409, 'RELATIONSHIP_EXISTS', 'An active relationship already exists.');
    }
    if (error.message === 'RELATIONSHIP_NOT_FOUND') {
      throw new AppError(404, 'RELATIONSHIP_NOT_FOUND', 'Active relationship was not found.');
    }
  }
  throw error;
}

export function createConnectionService(repository: ConnectionRepository, getCurrentUser: (userId: string) => Promise<AuthenticatedUser>) {
  async function requireUser(userId: string, role: 'doctor' | 'patient'): Promise<AuthenticatedUser> {
    const user = await getCurrentUser(userId);
    if (user.role !== role) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to access this resource.');
    }
    return user;
  }

  async function requireVerifiedDoctor(userId: string): Promise<{ user: AuthenticatedUser; profileId: string }> {
    const user = await requireUser(userId, 'doctor');
    if (user.doctorProfile?.verificationStatus !== 'verified') {
      throw new AppError(403, 'DOCTOR_VERIFICATION_REQUIRED', 'A verified doctor account is required.');
    }
    const profile = await repository.findDoctorByUserId(userId);
    if (!profile || profile.verificationStatus !== 'verified') {
      throw new AppError(403, 'DOCTOR_VERIFICATION_REQUIRED', 'A verified doctor account is required.');
    }
    return { user, profileId: profile.id };
  }

  return {
    async searchPatients(userId: string, email: string) {
      await requireVerifiedDoctor(userId);
      return repository.findPatientByEmail(email);
    },

    async createInvitation(userId: string, patientId: string) {
      const { user, profileId: doctorId } = await requireVerifiedDoctor(userId);
      const patient = await repository.findPatientById(patientId);
      if (!patient) {
        throw new AppError(404, 'PATIENT_NOT_FOUND', 'Patient was not found.');
      }
      if (patient.userId === user.id) {
        throw new AppError(400, 'SELF_INVITATION_NOT_ALLOWED', 'A user cannot invite themselves.');
      }
      try {
        return await repository.createInvitation({
          doctorId,
          patientId: patient.id,
          actorUserId: user.id,
          expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        });
      } catch (error) {
        return mapConnectionError(error);
      }
    },

    async listInvitations(userId: string) {
      const patient = await requireUser(userId, 'patient');
      const profile = await repository.findPatientByUserId(patient.id);
      if (!profile) throw new AppError(404, 'PATIENT_PROFILE_NOT_FOUND', 'Patient profile was not found.');
      return repository.listPatientInvitations(profile.id);
    },

    async respondToInvitation(userId: string, invitationId: string, action: 'accepted' | 'declined') {
      const patient = await requireUser(userId, 'patient');
      const profile = await repository.findPatientByUserId(patient.id);
      if (!profile) throw new AppError(404, 'PATIENT_PROFILE_NOT_FOUND', 'Patient profile was not found.');
      try {
        const result = await repository.respondToInvitation({
          invitationId,
          patientId: profile.id,
          action,
          now: new Date(),
          actorUserId: patient.id,
        });
        if (result === 'expired') {
          throw new AppError(409, 'INVITATION_EXPIRED', 'Invitation has expired.');
        }
        return result;
      } catch (error) {
        return mapConnectionError(error);
      }
    },

    async listConnectedPatients(userId: string, page: number, limit: number) {
      const { profileId } = await requireVerifiedDoctor(userId);
      return {
        items: await repository.listConnectedPatients(profileId, (page - 1) * limit, limit),
        page,
        limit,
      };
    },

    async revokeRelationship(userId: string, relationshipId: string) {
      const patient = await requireUser(userId, 'patient');
      const profile = await repository.findPatientByUserId(patient.id);
      if (!profile) throw new AppError(404, 'PATIENT_PROFILE_NOT_FOUND', 'Patient profile was not found.');
      try {
        await repository.revokeRelationship({ relationshipId, patientId: profile.id, now: new Date(), actorUserId: patient.id });
      } catch (error) {
        return mapConnectionError(error);
      }
    },
  };
}