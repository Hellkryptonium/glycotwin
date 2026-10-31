import { and, eq } from 'drizzle-orm';
import type { Database } from '../../config/database.js';
import { patientProfiles } from '../../db/schema/profiles.js';
import { doctorPatientRelationships } from '../../db/schema/relationships.js';
import type { DatabaseExecutor } from '../users/users.repository.js';

export type PatientProfileInput = {
  userId: string;
  fullName?: string | null;
};

export interface PatientProfileRepository {
  insertProfile(executor: DatabaseExecutor, input: PatientProfileInput): Promise<typeof patientProfiles.$inferSelect>;
  findByUserId(userId: string): Promise<typeof patientProfiles.$inferSelect | null>;
  findForDoctor(patientId: string, doctorId: string): Promise<typeof patientProfiles.$inferSelect | null>;
  updateProfile(userId: string, input: {
    fullName: string;
    dateOfBirth: Date | null;
    gender: string | null;
    diabetesType: string | null;
  }): Promise<typeof patientProfiles.$inferSelect | null>;
}

export function createPatientsRepository(database: Database): PatientProfileRepository {
  return {
    async insertProfile(executor: DatabaseExecutor, input: PatientProfileInput) {
      const rows = await executor.insert(patientProfiles).values(input).returning();
      const profile = rows[0];
      if (!profile) throw new Error('Patient profile insert did not return a row');
      return profile;
    },

    async findByUserId(userId: string) {
      const rows = await database.select().from(patientProfiles).where(eq(patientProfiles.userId, userId)).limit(1);
      return rows[0] ?? null;
    },

    async findForDoctor(patientId: string, doctorId: string) {
      const rows = await database.select().from(patientProfiles)
        .innerJoin(
          doctorPatientRelationships,
          and(
            eq(doctorPatientRelationships.patientId, patientProfiles.id),
            eq(doctorPatientRelationships.doctorId, doctorId),
            eq(doctorPatientRelationships.status, 'active'),
          ),
        )
        .where(eq(patientProfiles.id, patientId))
        .limit(1);
      return rows[0]?.patient_profiles ?? null;
    },

    async updateProfile(userId: string, input: {
      fullName: string;
      dateOfBirth: Date | null;
      gender: string | null;
      diabetesType: string | null;
    }) {
      const rows = await database.update(patientProfiles)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(patientProfiles.userId, userId))
        .returning();
      return rows[0] ?? null;
    },
  };
}