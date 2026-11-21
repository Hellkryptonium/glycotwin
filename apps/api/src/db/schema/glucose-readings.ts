import { decimal, index, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { pgTable } from 'drizzle-orm/pg-core';
import { glucoseContextEnum, glucoseSourceEnum, glucoseUnitEnum } from './enums.js';
import { patientProfiles } from './profiles.js';

export const glucoseReadings = pgTable(
  'glucose_readings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id').notNull().references(() => patientProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    value: decimal('value', { precision: 10, scale: 4 }).notNull(),
    unit: glucoseUnitEnum('unit').notNull(),
    measuredAt: timestamp('measured_at', { withTimezone: true, mode: 'date' }).notNull(),
    context: glucoseContextEnum('context').notNull(),
    source: glucoseSourceEnum('source').notNull().default('MANUAL'),
    externalId: varchar('external_id', { length: 255 }),
    deviceOrigin: varchar('device_origin', { length: 255 }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('glucose_readings_patient_measured_at_idx').on(table.patientId, table.measuredAt),
    index('glucose_readings_patient_context_idx').on(table.patientId, table.context),
    uniqueIndex('glucose_readings_external_identity_idx').on(table.patientId, table.source, table.externalId),
  ],
);
