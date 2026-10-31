import { date, index, integer, timestamp, uniqueIndex, uuid, varchar, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { doctorVerificationStatusEnum } from './enums.js';
import { users } from './users.js';
import { pgTable } from 'drizzle-orm/pg-core';

export const doctorProfiles = pgTable(
  'doctor_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    fullName: varchar('full_name', { length: 200 }),
    medicalRegistrationNumber: varchar('medical_registration_number', { length: 100 }),
    medicalCouncil: varchar('medical_council', { length: 200 }),
    specialization: varchar('specialization', { length: 200 }),
    hospitalOrClinic: varchar('hospital_or_clinic', { length: 255 }),
    yearsOfExperience: integer('years_of_experience'),
    verificationStatus: doctorVerificationStatusEnum('verification_status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('doctor_profiles_user_id_unique').on(table.userId),
    index('doctor_profiles_verification_status_idx').on(table.verificationStatus),
    check('doctor_profiles_years_of_experience_check', sql`${table.yearsOfExperience} IS NULL OR ${table.yearsOfExperience} >= 0`),
  ],
);

export const patientProfiles = pgTable(
  'patient_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    fullName: varchar('full_name', { length: 200 }),
    dateOfBirth: date('date_of_birth', { mode: 'date' }),
    gender: varchar('gender', { length: 100 }),
    diabetesType: varchar('diabetes_type', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('patient_profiles_user_id_unique').on(table.userId)],
);