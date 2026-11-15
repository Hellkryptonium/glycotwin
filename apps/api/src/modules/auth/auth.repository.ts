import { and, eq, inArray, or, isNull } from 'drizzle-orm';
import type { Database } from '../../config/database.js';
import { auditLogs } from '../../db/schema/audit-logs.js';
import { glucoseReadings } from '../../db/schema/glucose-readings.js';
import { doctorPatientInvitations } from '../../db/schema/invitations.js';
import { lifestyleEntries } from '../../db/schema/lifestyle-entries.js';
import { medicationDoses, medications } from '../../db/schema/medications.js';
import { doctorPatientRelationships } from '../../db/schema/relationships.js';
import { doctorProfiles, patientProfiles } from '../../db/schema/profiles.js';
import { refreshTokens } from '../../db/schema/refresh-tokens.js';
import { users } from '../../db/schema/users.js';
import type { AuthRepository, NewRefreshToken, RefreshTokenRecord } from './auth.types.js';

function toRefreshTokenRecord(row: typeof refreshTokens.$inferSelect): RefreshTokenRecord {
  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}

export function createAuthRepository(database: Database): AuthRepository {
  return {
    async findRefreshTokenById(id) {
      const rows = await database.select().from(refreshTokens).where(eq(refreshTokens.id, id)).limit(1);
      return rows[0] ? toRefreshTokenRecord(rows[0]) : null;
    },

    async insertRefreshToken(input) {
      await database.insert(refreshTokens).values(input);
    },

    async revokeRefreshToken(id, revokedAt) {
      await database.update(refreshTokens).set({ revokedAt }).where(and(eq(refreshTokens.id, id), isNull(refreshTokens.revokedAt)));
    },

    async revokeUserRefreshTokens(userId, revokedAt) {
      await database.update(refreshTokens).set({ revokedAt }).where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
    },

    async rotateRefreshToken(oldId, newToken: NewRefreshToken, revokedAt) {
      return database.transaction(async (transaction) => {
        const revoked = await transaction.update(refreshTokens)
          .set({ revokedAt })
          .where(and(eq(refreshTokens.id, oldId), isNull(refreshTokens.revokedAt)))
          .returning({ id: refreshTokens.id });
        if (revoked.length === 0) {
          return false;
        }
        await transaction.insert(refreshTokens).values(newToken);
        return true;
      });
    },

    async deleteAccount(userId) {
      await database.transaction(async (transaction) => {
        const patientProfileRows = await transaction.select({ id: patientProfiles.id })
          .from(patientProfiles)
          .where(eq(patientProfiles.userId, userId));
        const doctorProfileRows = await transaction.select({ id: doctorProfiles.id })
          .from(doctorProfiles)
          .where(eq(doctorProfiles.userId, userId));
        const patientIds = patientProfileRows.map((row) => row.id);
        const doctorIds = doctorProfileRows.map((row) => row.id);

        if (patientIds.length > 0) {
          await transaction.delete(medicationDoses).where(inArray(medicationDoses.patientId, patientIds));
          await transaction.delete(medications).where(inArray(medications.patientId, patientIds));
          await transaction.delete(glucoseReadings).where(inArray(glucoseReadings.patientId, patientIds));
          await transaction.delete(lifestyleEntries).where(inArray(lifestyleEntries.patientId, patientIds));
        }

        if (patientIds.length > 0 || doctorIds.length > 0) {
          const participantCondition = [
            patientIds.length > 0 ? inArray(doctorPatientRelationships.patientId, patientIds) : undefined,
            doctorIds.length > 0 ? inArray(doctorPatientRelationships.doctorId, doctorIds) : undefined,
          ].filter((condition): condition is Exclude<typeof condition, undefined> => condition !== undefined);
          await transaction.delete(doctorPatientRelationships).where(or(...participantCondition));

          const invitationCondition = [
            patientIds.length > 0 ? inArray(doctorPatientInvitations.patientId, patientIds) : undefined,
            doctorIds.length > 0 ? inArray(doctorPatientInvitations.doctorId, doctorIds) : undefined,
          ].filter((condition): condition is Exclude<typeof condition, undefined> => condition !== undefined);
          await transaction.delete(doctorPatientInvitations).where(or(...invitationCondition));
        }

        await transaction.delete(patientProfiles).where(eq(patientProfiles.userId, userId));
        await transaction.delete(doctorProfiles).where(eq(doctorProfiles.userId, userId));
        await transaction.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
        await transaction.delete(auditLogs).where(eq(auditLogs.actorUserId, userId));

        const deletedUsers = await transaction.delete(users).where(eq(users.id, userId)).returning({ id: users.id });
        if (deletedUsers.length === 0) {
          throw new Error('Authenticated user could not be deleted.');
        }
      });
    },
  };
}