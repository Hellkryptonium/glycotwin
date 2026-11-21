import { and, eq, gt, inArray, or, isNull } from 'drizzle-orm';
import type { Database } from '../../config/database.js';
import { auditLogs } from '../../db/schema/audit-logs.js';
import { authSessions } from '../../db/schema/account-security.js';
import { AppError } from '../../common/errors/app-error.js';
import { glucoseReadings } from '../../db/schema/glucose-readings.js';
import { doctorPatientInvitations } from '../../db/schema/invitations.js';
import { lifestyleEntries } from '../../db/schema/lifestyle-entries.js';
import { medicationDoses, medications } from '../../db/schema/medications.js';
import { doctorPatientRelationships } from '../../db/schema/relationships.js';
import { doctorProfiles, patientProfiles } from '../../db/schema/profiles.js';
import { refreshTokens } from '../../db/schema/refresh-tokens.js';
import { users } from '../../db/schema/users.js';
import type { DatabaseExecutor } from '../users/users.repository.js';
import type { AuthRepository, NewRefreshToken, RefreshTokenRecord } from './auth.types.js';

function toRefreshTokenRecord(row: typeof refreshTokens.$inferSelect): RefreshTokenRecord {
  return {
    id: row.id,
    userId: row.userId,
    sessionId: row.sessionId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}

async function insertInitialSession(transaction: DatabaseExecutor, input: NewRefreshToken): Promise<void> {
  await transaction.insert(authSessions).values({ id: input.sessionId, userId: input.userId, expiresAt: input.expiresAt });
  await transaction.insert(refreshTokens).values(input);
}

export function createAuthRepository(database: Database): AuthRepository {
  return {
    insertInitialSession,

    async findRefreshTokenById(id) {
      const rows = await database.select().from(refreshTokens).where(eq(refreshTokens.id, id)).limit(1);
      return rows[0] ? toRefreshTokenRecord(rows[0]) : null;
    },

    async insertRefreshToken(input, expectedPasswordHash) {
      return database.transaction(async (transaction) => {
        const [user] = await transaction.select({ id: users.id }).from(users).where(and(
          eq(users.id, input.userId), eq(users.isActive, true), eq(users.passwordHash, expectedPasswordHash),
        )).for('update');
        if (!user) return false;
        await insertInitialSession(transaction, input);
        return true;
      });
    },

    async isSessionActive(sessionId, userId, now) {
      const [record] = await database.select({ id: authSessions.id }).from(authSessions)
        .innerJoin(users, eq(users.id, authSessions.userId))
        .where(and(eq(authSessions.id, sessionId), eq(authSessions.userId, userId),
          eq(users.isActive, true), isNull(authSessions.revokedAt), gt(authSessions.expiresAt, now))).limit(1);
      return !!record;
    },

    async revokeSession(sessionId, revokedAt) {
      await database.update(authSessions).set({ revokedAt }).where(and(eq(authSessions.id, sessionId), isNull(authSessions.revokedAt)));
    },

    async rotateRefreshToken(oldId, newToken: NewRefreshToken, revokedAt) {
      return database.transaction(async (transaction) => {
        const [user] = await transaction.select({ id: users.id }).from(users)
          .where(and(eq(users.id, newToken.userId), eq(users.isActive, true))).for('update');
        if (!user) return false;
        const [session] = await transaction.select({ id: authSessions.id }).from(authSessions).where(and(
          eq(authSessions.id, newToken.sessionId), eq(authSessions.userId, user.id),
          isNull(authSessions.revokedAt), gt(authSessions.expiresAt, new Date()),
        )).for('update');
        if (!session) return false;
        const revoked = await transaction.update(refreshTokens)
          .set({ revokedAt })
          .where(and(eq(refreshTokens.id, oldId), eq(refreshTokens.sessionId, newToken.sessionId), isNull(refreshTokens.revokedAt)))
          .returning({ id: refreshTokens.id });
        if (revoked.length === 0) {
          return false;
        }
        await transaction.insert(refreshTokens).values(newToken);
        return true;
      });
    },

    async updatePassword(userId, expectedPasswordHash, passwordHash) {
      return database.transaction(async (transaction) => {
        const now = new Date();
        const [user] = await transaction.update(users).set({ passwordHash, updatedAt: now }).where(and(
          eq(users.id, userId), eq(users.isActive, true), eq(users.passwordHash, expectedPasswordHash),
        )).returning({ id: users.id });
        if (!user) return false;
        await transaction.update(authSessions).set({ revokedAt: now }).where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
        await transaction.insert(auditLogs).values({ actorUserId: userId, action: 'account.password.changed', resourceType: 'user', resourceId: userId });
        return true;
      });
    },

    async deleteAccount(userId, expectedPasswordHash) {
      await database.transaction(async (transaction) => {
        const [account] = await transaction.select({ id: users.id }).from(users)
          .where(and(eq(users.id, userId), eq(users.passwordHash, expectedPasswordHash))).for('update');
        if (!account) throw new AppError(403, 'INCORRECT_CURRENT_PASSWORD', 'The current password is incorrect.');
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
