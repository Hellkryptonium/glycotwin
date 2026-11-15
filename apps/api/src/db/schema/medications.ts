import { check, index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { patientProfiles } from './profiles.js';

export const medications = pgTable('medications', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').notNull().references(() => patientProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  dosage: varchar('dosage', { length: 200 }).notNull(),
  frequency: varchar('frequency', { length: 100 }).notNull(),
  scheduleTimes: text('schedule_times').array().notNull(),
  startDate: timestamp('start_date', { withTimezone: true, mode: 'date' }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true, mode: 'date' }),
  instructions: text('instructions'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  discontinuedAt: timestamp('discontinued_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  index('medications_patient_idx').on(table.patientId),
  index('medications_patient_status_idx').on(table.patientId, table.status),
  check('medications_status_check', sql`${table.status} IN ('active', 'discontinued')`),
  check('medications_dates_check', sql`${table.endDate} IS NULL OR ${table.endDate} >= ${table.startDate}`),
]);

export const medicationDoses = pgTable('medication_doses', {
  id: uuid('id').defaultRandom().primaryKey(),
  medicationId: uuid('medication_id').notNull().references(() => medications.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patientProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true, mode: 'date' }).notNull(),
  takenAt: timestamp('taken_at', { withTimezone: true, mode: 'date' }),
  status: varchar('status', { length: 20 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  index('medication_doses_medication_scheduled_idx').on(table.medicationId, table.scheduledAt),
  index('medication_doses_patient_scheduled_idx').on(table.patientId, table.scheduledAt),
  check('medication_doses_status_check', sql`${table.status} IN ('taken', 'skipped', 'missed')`),
]);
