import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import type { Database } from '../../config/database.js';
import { doctorPatientRelationships } from '../../db/schema/relationships.js';
import { lifestyleEntries } from '../../db/schema/lifestyle-entries.js';
import { patientProfiles } from '../../db/schema/profiles.js';
import type { LifestyleInput, LifestyleListInput } from './lifestyle.schema.js';

const conditions = (patientId: string, input: LifestyleListInput) => and(
  eq(lifestyleEntries.patientId, patientId),
  input.from ? gte(lifestyleEntries.occurredAt, input.from) : undefined,
  input.to ? lte(lifestyleEntries.occurredAt, input.to) : undefined,
  input.type ? eq(lifestyleEntries.type, input.type) : undefined,
);
const values = (input: LifestyleInput) => ({
  type: input.type,
  occurredAt: input.occurredAt,
  mealType: input.type === 'meal' ? input.mealType : null,
  description: 'description' in input ? input.description ?? null : null,
  activityType: input.type === 'activity' ? input.activityType : null,
  durationMinutes: input.type === 'activity' ? input.durationMinutes : null,
  sleepDurationMinutes: input.type === 'sleep' ? input.sleepDurationMinutes : null,
  notes: input.notes ?? null,
});
export function createLifestyleRepository(database: Database) {
  return {
    async findPatientByUserId(userId: string) {
      const rows = await database.select({ id: patientProfiles.id }).from(patientProfiles).where(eq(patientProfiles.userId, userId)).limit(1);
      return rows[0] ?? null;
    },
    async findPatientForDoctor(patientId: string, doctorId: string) {
      const rows = await database.select({ patientId: patientProfiles.id }).from(patientProfiles).innerJoin(doctorPatientRelationships, and(
        eq(doctorPatientRelationships.patientId, patientProfiles.id),
        eq(doctorPatientRelationships.doctorId, doctorId),
        eq(doctorPatientRelationships.status, 'active'),
      )).where(eq(patientProfiles.id, patientId)).limit(1);
      return rows[0] ?? null;
    },
    async create(patientId: string, input: LifestyleInput) {
      const rows = await database.insert(lifestyleEntries).values({ patientId, ...values(input) }).returning();
      return rows[0]!;
    },
    async list(patientId: string, input: LifestyleListInput) {
      return database.select().from(lifestyleEntries).where(conditions(patientId, input))
        .orderBy(desc(lifestyleEntries.occurredAt), desc(lifestyleEntries.createdAt))
        .limit(input.limit).offset((input.page - 1) * input.limit);
    },
    async findById(id: string) {
      const rows = await database.select().from(lifestyleEntries).where(eq(lifestyleEntries.id, id)).limit(1);
      return rows[0] ?? null;
    },
    async update(id: string, patientId: string, input: LifestyleInput) {
      const rows = await database.update(lifestyleEntries).set({ ...values(input), updatedAt: new Date() })
        .where(and(eq(lifestyleEntries.id, id), eq(lifestyleEntries.patientId, patientId))).returning();
      return rows[0] ?? null;
    },
    async remove(id: string, patientId: string) {
      const rows = await database.delete(lifestyleEntries).where(and(eq(lifestyleEntries.id, id), eq(lifestyleEntries.patientId, patientId))).returning({ id: lifestyleEntries.id });
      return rows[0] ?? null;
    },
  };
}
