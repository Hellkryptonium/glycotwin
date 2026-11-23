import { index, integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const mediaAssets = pgTable('media_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  purpose: varchar('purpose', { length: 40 }).$type<'PROFILE_PHOTO' | 'AI_ATTACHMENT' | 'CLINICAL_DOCUMENT'>().notNull(),
  status: varchar('status', { length: 20 }).$type<'PENDING' | 'READY' | 'REJECTED'>().notNull().default('PENDING'),
  objectKey: varchar('object_key', { length: 600 }).notNull().unique(),
  contentType: varchar('content_type', { length: 100 }).notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  originalFileName: varchar('original_file_name', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [index('media_assets_owner_created_idx').on(table.ownerUserId, table.createdAt), index('media_assets_status_idx').on(table.status)]);
