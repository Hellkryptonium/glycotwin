import { check, index, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pgTable } from 'drizzle-orm/pg-core';
import { relationshipStatusEnum } from './enums.js';
import { doctorPatientInvitations } from './invitations.js';
import { doctorProfiles, patientProfiles } from './profiles.js';

export const doctorPatientRelationships = pgTable(
  'doctor_patient_relationships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    doctorId: uuid('doctor_id').notNull().references(() => doctorProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    patientId: uuid('patient_id').notNull().references(() => patientProfiles.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    invitationId: uuid('invitation_id').notNull().references(() => doctorPatientInvitations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    status: relationshipStatusEnum('status').notNull().default('active'),
    consentedAt: timestamp('consented_at', { withTimezone: true, mode: 'date' }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('doctor_patient_active_relationship_unique')
      .on(table.doctorId, table.patientId)
      .where(sql`${table.status} = 'active'`),
    uniqueIndex('doctor_patient_relationship_invitation_unique').on(table.invitationId),
    index('doctor_patient_relationships_patient_status_idx').on(table.patientId, table.status),
    check(
      'doctor_patient_relationships_revocation_consistency_check',
      sql`(${table.status} = 'active' AND ${table.revokedAt} IS NULL) OR (${table.status} = 'revoked' AND ${table.revokedAt} IS NOT NULL)`,
    ),
  ],
);