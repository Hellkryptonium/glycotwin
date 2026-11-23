import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { patientProfiles } from './profiles.js';
import { users } from './users.js';

export const aiConversations = pgTable('ai_conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  doctorUserId: uuid('doctor_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  patientProfileId: uuid('patient_profile_id').references(() => patientProfiles.id, { onDelete: 'cascade' }),
  mode: varchar('mode', { length: 16 }).$type<'GENERAL' | 'PATIENT'>().notNull(),
  title: varchar('title', { length: 120 }).notNull().default('New conversation'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  index('ai_conversations_doctor_updated_idx').on(table.doctorUserId, table.updatedAt),
  index('ai_conversations_patient_idx').on(table.patientProfileId),
]);

export const aiMessages = pgTable('ai_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').notNull().references(() => aiConversations.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 16 }).$type<'DOCTOR' | 'ASSISTANT'>().notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [index('ai_messages_conversation_created_idx').on(table.conversationId, table.createdAt)]);

// Patient conversations intentionally use separate tables from the clinician
// workspace. This prevents a patient token from ever being accepted by the
// doctor-scoped repository or its clinical tool chain.
export const patientAiConversations = pgTable('patient_ai_conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientProfileId: uuid('patient_profile_id').notNull().references(() => patientProfiles.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 120 }).notNull().default('New conversation'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [index('patient_ai_conversations_patient_updated_idx').on(table.patientProfileId, table.updatedAt)]);

export const patientAiMessages = pgTable('patient_ai_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').notNull().references(() => patientAiConversations.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 16 }).$type<'PATIENT' | 'ASSISTANT'>().notNull(),
  content: text('content').notNull(),
  reviewKind: varchar('review_kind', { length: 16 }).$type<'FOOD' | 'MEDICATION' | null>(),
  imageName: varchar('image_name', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [index('patient_ai_messages_conversation_created_idx').on(table.conversationId, table.createdAt)]);
