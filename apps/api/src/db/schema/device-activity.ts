import { check, doublePrecision, index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { patientProfiles } from './profiles.js';

export const deviceActivity = pgTable('device_activity', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').notNull().references(() => patientProfiles.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  externalId: uuid('external_id').notNull(),
  kind: varchar('kind', { length: 20 }).notNull(),
  measuredAt: timestamp('measured_at', { withTimezone: true, mode: 'date' }).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
  value: doublePrecision('value'),
  activityType: varchar('activity_type', { length: 100 }),
  source: varchar('source', { length: 20 }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('device_activity_external_identity_idx').on(table.patientId, table.externalId),
  index('device_activity_patient_measured_at_idx').on(table.patientId, table.measuredAt),
  check('device_activity_kind_check', sql`${table.kind} IN ('steps', 'workout', 'heart_rate')`),
  check('device_activity_source_check', sql`${table.source} IN ('WATCH', 'REPLAY')`),
]);
