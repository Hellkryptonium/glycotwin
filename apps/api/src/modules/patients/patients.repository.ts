import { eq } from 'drizzle-orm';
import type { Database } from '../../config/database.js';
import { patientProfiles } from '../../db/schema/profiles.js';
import type { DatabaseExecutor } from '../users/users.repository.js';

export type PatientProfileInput = {
  userId: string;
  fullName?: string | null;
};

export function createPatientsRepository(database: Database) {
  return {
    async insertProfile(executor: DatabaseExecutor, input: PatientProfileInput) {
      const rows = await executor.insert(patientProfiles).values(input).returning();
      return rows[0];
    },

    async findByUserId(userId: string) {
      const rows = await database.select().from(patientProfiles).where(eq(patientProfiles.userId, userId)).limit(1);
      return rows[0] ?? null;
    },
  };
}