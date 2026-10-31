import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '../../config/database.js';
import { auditLogs } from '../../db/schema/audit-logs.js';
import { doctorPatientInvitations } from '../../db/schema/invitations.js';
import { doctorPatientRelationships } from '../../db/schema/relationships.js';
import { doctorProfiles, patientProfiles } from '../../db/schema/profiles.js';
import { users } from '../../db/schema/users.js';
import type { DatabaseExecutor } from '../users/users.repository.js';
import type { ConnectionRepository, ConnectedPatient, InvitationSummary, PatientSearchResult } from './connection.types.js';

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

export function createConnectionRepository(database: Database): ConnectionRepository {
  const insertAudit = async (executor: DatabaseExecutor, input: {
    actorUserId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    metadata?: Record<string, unknown>;
  }) => {
    await executor.insert(auditLogs).values({
      actorUserId: input.actorUserId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: input.metadata ?? {},
    });
  };

  return {
    async findPatientByEmail(email): Promise<PatientSearchResult | null> {
      const rows = await database.select({
        patientId: patientProfiles.id,
        email: users.email,
        fullName: patientProfiles.fullName,
      }).from(users)
        .innerJoin(patientProfiles, eq(patientProfiles.userId, users.id))
        .where(and(eq(users.email, email), eq(users.role, 'patient'), eq(users.isActive, true)))
        .limit(1);
      return rows[0] ?? null;
    },

    async findDoctorByUserId(userId) {
      const rows = await database.select({
        id: doctorProfiles.id,
        userId: doctorProfiles.userId,
        verificationStatus: doctorProfiles.verificationStatus,
      }).from(doctorProfiles).where(eq(doctorProfiles.userId, userId)).limit(1);
      return rows[0] ?? null;
    },

    async findPatientByUserId(userId) {
      const rows = await database.select({ id: patientProfiles.id, userId: patientProfiles.userId })
        .from(patientProfiles).where(eq(patientProfiles.userId, userId)).limit(1);
      return rows[0] ?? null;
    },

    async findPatientById(id) {
      const rows = await database.select({ id: patientProfiles.id, userId: patientProfiles.userId })
        .from(patientProfiles)
        .innerJoin(users, eq(users.id, patientProfiles.userId))
        .where(and(eq(patientProfiles.id, id), eq(users.role, 'patient'), eq(users.isActive, true)))
        .limit(1);
      return rows[0] ?? null;
    },

    async createInvitation(input) {
      try {
        return await database.transaction(async (transaction) => {
          const rows = await transaction.insert(doctorPatientInvitations).values({
            doctorId: input.doctorId,
            patientId: input.patientId,
            expiresAt: input.expiresAt,
          }).returning({
            id: doctorPatientInvitations.id,
            status: doctorPatientInvitations.status,
            expiresAt: doctorPatientInvitations.expiresAt,
            createdAt: doctorPatientInvitations.createdAt,
          });
          const invitation = rows[0];
          if (!invitation) throw new Error('Invitation insert did not return a row');
          await insertAudit(transaction, {
            actorUserId: input.actorUserId,
            action: 'doctor.invitation.created',
            resourceType: 'doctor_patient_invitation',
            resourceId: invitation.id,
          });
          return invitation;
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new Error('PENDING_INVITATION_EXISTS');
        }
        throw error;
      }
    },

    async listPatientInvitations(patientId): Promise<InvitationSummary[]> {
      return database.select({
        id: doctorPatientInvitations.id,
        status: doctorPatientInvitations.status,
        expiresAt: doctorPatientInvitations.expiresAt,
        respondedAt: doctorPatientInvitations.respondedAt,
        createdAt: doctorPatientInvitations.createdAt,
        doctor: {
          id: doctorProfiles.id,
          fullName: doctorProfiles.fullName,
        },
      }).from(doctorPatientInvitations)
        .innerJoin(doctorProfiles, eq(doctorProfiles.id, doctorPatientInvitations.doctorId))
        .where(eq(doctorPatientInvitations.patientId, patientId))
        .orderBy(asc(doctorPatientInvitations.createdAt));
    },

    async respondToInvitation(input) {
      return database.transaction(async (transaction) => {
        const invitations = await transaction.select().from(doctorPatientInvitations)
          .where(and(eq(doctorPatientInvitations.id, input.invitationId), eq(doctorPatientInvitations.patientId, input.patientId)))
          .limit(1);
        const invitation = invitations[0];
        if (!invitation) throw new Error('INVITATION_NOT_FOUND');
        if (invitation.status !== 'pending') throw new Error('INVITATION_NOT_PENDING');
        if (invitation.expiresAt <= input.now) {
          await transaction.update(doctorPatientInvitations).set({
            status: 'expired', respondedAt: input.now, updatedAt: input.now,
          }).where(eq(doctorPatientInvitations.id, input.invitationId));
          await insertAudit(transaction, {
            actorUserId: input.actorUserId,
            action: 'patient.invitation.expired',
            resourceType: 'doctor_patient_invitation',
            resourceId: input.invitationId,
          });
          return 'expired';
        }

        const updated = await transaction.update(doctorPatientInvitations).set({
          status: input.action,
          respondedAt: input.now,
          updatedAt: input.now,
        }).where(and(eq(doctorPatientInvitations.id, input.invitationId), eq(doctorPatientInvitations.status, 'pending')))
          .returning({ id: doctorPatientInvitations.id });
        if (updated.length === 0) throw new Error('INVITATION_NOT_PENDING');

        if (input.action === 'accepted') {
          try {
            await transaction.insert(doctorPatientRelationships).values({
              doctorId: invitation.doctorId,
              patientId: invitation.patientId,
              invitationId: invitation.id,
              status: 'active',
              consentedAt: input.now,
              updatedAt: input.now,
            });
          } catch (error) {
            if (isUniqueViolation(error)) throw new Error('RELATIONSHIP_EXISTS');
            throw error;
          }
        }

        await insertAudit(transaction, {
          actorUserId: input.actorUserId,
          action: input.action === 'accepted' ? 'patient.invitation.accepted' : 'patient.invitation.declined',
          resourceType: 'doctor_patient_invitation',
          resourceId: input.invitationId,
          metadata: { relationshipCreated: input.action === 'accepted' },
        });
        return input.action;
      });
    },

    async listConnectedPatients(doctorId, offset, limit): Promise<ConnectedPatient[]> {
      return database.select({
        relationshipId: doctorPatientRelationships.id,
        patientId: patientProfiles.id,
        fullName: patientProfiles.fullName,
        connectedAt: doctorPatientRelationships.consentedAt,
      }).from(doctorPatientRelationships)
        .innerJoin(patientProfiles, eq(patientProfiles.id, doctorPatientRelationships.patientId))
        .where(and(eq(doctorPatientRelationships.doctorId, doctorId), eq(doctorPatientRelationships.status, 'active')))
        .orderBy(asc(doctorPatientRelationships.consentedAt))
        .limit(limit).offset(offset);
    },

    async revokeRelationship(input) {
      await database.transaction(async (transaction) => {
        const updated = await transaction.update(doctorPatientRelationships).set({
          status: 'revoked', revokedAt: input.now, updatedAt: input.now,
        }).where(and(
          eq(doctorPatientRelationships.id, input.relationshipId),
          eq(doctorPatientRelationships.patientId, input.patientId),
          eq(doctorPatientRelationships.status, 'active'),
        )).returning({ id: doctorPatientRelationships.id });
        if (updated.length === 0) throw new Error('RELATIONSHIP_NOT_FOUND');
        await insertAudit(transaction, {
          actorUserId: input.actorUserId,
          action: 'patient.relationship.revoked',
          resourceType: 'doctor_patient_relationship',
          resourceId: input.relationshipId,
        });
      });
    },
  };
}