import { eq } from 'drizzle-orm';
import type { Database } from '../../config/database.js';
import { doctorProfiles } from '../../db/schema/profiles.js';
import type { DatabaseExecutor } from '../users/users.repository.js';

export type DoctorProfileInput = {
  userId: string;
  fullName?: string | null;
  medicalRegistrationNumber?: string | null;
  medicalCouncil?: string | null;
  specialization?: string | null;
  hospitalOrClinic?: string | null;
  yearsOfExperience?: number | null;
  verificationStatus?: 'pending' | 'verified' | 'rejected';
};

export function createDoctorsRepository(database: Database) {
  return {
    async insertProfile(executor: DatabaseExecutor, input: DoctorProfileInput) {
      const rows = await executor.insert(doctorProfiles).values(input).returning();
      return rows[0];
    },

    async findByUserId(userId: string) {
      const rows = await database.select().from(doctorProfiles).where(eq(doctorProfiles.userId, userId)).limit(1);
      return rows[0] ?? null;
    },
  };
}