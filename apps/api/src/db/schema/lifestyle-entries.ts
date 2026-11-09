import { check, index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { patientProfiles } from './profiles.js';

export const lifestyleEntries = pgTable('lifestyle_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').notNull().references(() => patientProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }).notNull(),
  mealType: varchar('meal_type', { length: 20 }),
  description: text('description'),
  activityType: varchar('activity_type', { length: 100 }),
  durationMinutes: integer('duration_minutes'),
  sleepDurationMinutes: integer('sleep_duration_minutes'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  index('lifestyle_entries_patient_occurred_at_idx').on(table.patientId, table.occurredAt),
  index('lifestyle_entries_patient_type_idx').on(table.patientId, table.type),
  check('lifestyle_entries_type_check', sql`${table.type} IN ('meal', 'activity', 'sleep', 'symptom')`),
  check('lifestyle_entries_duration_check', sql`${table.durationMinutes} IS NULL OR ${table.durationMinutes} > 0`),
  check('lifestyle_entries_sleep_duration_check', sql`${table.sleepDurationMinutes} IS NULL OR ${table.sleepDurationMinutes} > 0`),
]);
