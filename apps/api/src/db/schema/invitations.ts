import { index, timestamp, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pgTable } from 'drizzle-orm/pg-core';
import { invitationStatusEnum } from './enums.js';
import { doctorProfiles, patientProfiles } from './profiles.js';

export const doctorPatientInvitations = pgTable(
  'doctor_patient_invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    doctorId: uuid('doctor_id').notNull().references(() => doctorProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    patientId: uuid('patient_id').notNull().references(() => patientProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    status: invitationStatusEnum('status').notNull().default('pending'),
    message: text('message'),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('doctor_patient_pending_invitation_unique')
      .on(table.doctorId, table.patientId)
      .where(sql`${table.status} = 'pending'`),
    index('doctor_patient_invitations_patient_status_idx').on(table.patientId, table.status),
    index('doctor_patient_invitations_doctor_status_idx').on(table.doctorId, table.status),
  ],
);