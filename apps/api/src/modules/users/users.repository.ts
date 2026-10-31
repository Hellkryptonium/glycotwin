import { eq } from 'drizzle-orm';
import type { Database } from '../../config/database.js';
import { users } from '../../db/schema/users.js';
import type { UserRecord } from '../auth/auth.types.js';

export type DatabaseExecutor = Pick<Database, 'insert' | 'select'>;

function toUserRecord(row: typeof users.$inferSelect): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role,
    isActive: row.isActive,
    emailVerifiedAt: row.emailVerifiedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createUsersRepository(database: Database) {
  return {
    async findByEmail(email: string): Promise<UserRecord | null> {
      const rows = await database.select().from(users).where(eq(users.email, email)).limit(1);
      return rows[0] ? toUserRecord(rows[0]) : null;
    },

    async findById(id: string): Promise<UserRecord | null> {
      const rows = await database.select().from(users).where(eq(users.id, id)).limit(1);
      return rows[0] ? toUserRecord(rows[0]) : null;
    },

    async insertUser(executor: DatabaseExecutor, input: {
      email: string;
      passwordHash: string;
      role: 'doctor' | 'patient';
    }): Promise<UserRecord> {
      const rows = await executor.insert(users).values(input).returning();
      const row = rows[0];
      if (!row) {
        throw new Error('User insert did not return a row');
      }
      return toUserRecord(row);
    },
  };
}