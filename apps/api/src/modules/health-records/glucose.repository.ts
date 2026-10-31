import { and, desc, eq, gte, lte } from 'drizzle-orm';
import type { Database } from '../../config/database.js';
import { auditLogs } from '../../db/schema/audit-logs.js';
import { glucoseReadings } from '../../db/schema/glucose-readings.js';
import { doctorPatientRelationships } from '../../db/schema/relationships.js';
import { patientProfiles } from '../../db/schema/profiles.js';
import type { DatabaseExecutor } from '../users/users.repository.js';
import type { GlucoseListInput, GlucoseReading } from './glucose.types.js';

function listConditions(patientId: string, input: GlucoseListInput) {
  return and(
    eq(glucoseReadings.patientId, patientId),
    input.from ? gte(glucoseReadings.measuredAt, input.from) : undefined,
    input.to ? lte(glucoseReadings.measuredAt, input.to) : undefined,
    input.context ? eq(glucoseReadings.context, input.context) : undefined,
  );
}

export function createGlucoseRepository(database: Database) {
  const audit = async (executor: DatabaseExecutor, actorUserId: string, action: string, resourceId: string) => {
    await executor.insert(auditLogs).values({ actorUserId, action, resourceType: 'glucose_reading', resourceId });
  };

  return {
    async findPatientByUserId(userId: string) {
      const rows = await database.select({ id: patientProfiles.id }).from(patientProfiles).where(eq(patientProfiles.userId, userId)).limit(1);
      return rows[0] ?? null;
    },

    async findPatientForDoctor(patientId: string, doctorId: string) {
      const rows = await database.select({ patientId: patientProfiles.id }).from(patientProfiles)
        .innerJoin(doctorPatientRelationships, and(
          eq(doctorPatientRelationships.patientId, patientProfiles.id),
          eq(doctorPatientRelationships.doctorId, doctorId),
          eq(doctorPatientRelationships.status, 'active'),
        ))
        .where(eq(patientProfiles.id, patientId)).limit(1);
      return rows[0] ?? null;
    },

    async create(patientId: string, actorUserId: string, input: {
      value: string;
      unit: 'mg/dL' | 'mmol/L';
      measuredAt: Date;
      context: 'FASTING' | 'BEFORE_MEAL' | 'AFTER_MEAL' | 'RANDOM';
      notes: string | null;
    }): Promise<GlucoseReading> {
      return database.transaction(async (transaction) => {
        const rows = await transaction.insert(glucoseReadings).values({ patientId, ...input }).returning();
        const reading = rows[0];
        if (!reading) throw new Error('Glucose reading insert did not return a row');
        await audit(transaction, actorUserId, 'patient.glucose_reading.created', reading.id);
        return reading;
      });
    },

    async list(patientId: string, input: GlucoseListInput) {
      const rows = await database.select().from(glucoseReadings)
        .where(listConditions(patientId, input))
        .orderBy(desc(glucoseReadings.measuredAt), desc(glucoseReadings.createdAt))
        .limit(input.limit).offset((input.page - 1) * input.limit);
      return rows;
    },

    async findById(id: string) {
      const rows = await database.select().from(glucoseReadings).where(eq(glucoseReadings.id, id)).limit(1);
      return rows[0] ?? null;
    },

    async update(id: string, patientId: string, actorUserId: string, input: {
      value: string;
      unit: 'mg/dL' | 'mmol/L';
      measuredAt: Date;
      context: 'FASTING' | 'BEFORE_MEAL' | 'AFTER_MEAL' | 'RANDOM';
      notes: string | null;
    }) {
      return database.transaction(async (transaction) => {
        const rows = await transaction.update(glucoseReadings).set({ ...input, updatedAt: new Date() })
          .where(and(eq(glucoseReadings.id, id), eq(glucoseReadings.patientId, patientId), eq(glucoseReadings.source, 'MANUAL')))
          .returning();
        const reading = rows[0] ?? null;
        if (reading) await audit(transaction, actorUserId, 'patient.glucose_reading.updated', reading.id);
        return reading;
      });
    },

    async remove(id: string, patientId: string, actorUserId: string) {
      return database.transaction(async (transaction) => {
        const rows = await transaction.delete(glucoseReadings)
          .where(and(eq(glucoseReadings.id, id), eq(glucoseReadings.patientId, patientId), eq(glucoseReadings.source, 'MANUAL')))
          .returning({ id: glucoseReadings.id });
        const reading = rows[0] ?? null;
        if (reading) await audit(transaction, actorUserId, 'patient.glucose_reading.deleted', reading.id);
        return reading;
      });
    },
  };
}
