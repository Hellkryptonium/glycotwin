import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../config/database.js';
import { refreshTokens } from '../../db/schema/refresh-tokens.js';
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
  };
}