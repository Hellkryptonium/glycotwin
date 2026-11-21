import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const authSessions = pgTable('auth_sessions', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [index('auth_sessions_user_idx').on(table.userId)]);

