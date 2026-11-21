import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { Database } from '../../config/database.js';
import { auditLogs } from '../../db/schema/audit-logs.js';
import { doctorPatientRelationships } from '../../db/schema/relationships.js';
import { medicationDoses, medications } from '../../db/schema/medications.js';
import { patientProfiles } from '../../db/schema/profiles.js';
import type { DoseInput, DoseListInput, MedicationInput, MedicationListInput } from './medication.schema.js';

const medicationValues = (input: MedicationInput) => ({
  ...input,
  endDate: input.endDate ?? null,
  instructions: input.instructions ?? null,
});

export function createMedicationRepository(database: Database) {
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
    async create(patientId: string, actorUserId: string, input: MedicationInput) {
      return database.transaction(async (transaction) => {
        const [medication] = await transaction.insert(medications).values({ patientId, ...medicationValues(input) }).returning();
        if (!medication) throw new Error('Medication insert returned no row.');
        await transaction.insert(auditLogs).values({ actorUserId, action: 'patient.medication.created', resourceType: 'medication', resourceId: medication.id });
        return medication;
      });
    },
    async list(patientId: string, input: MedicationListInput) {
      return database.select().from(medications).where(and(eq(medications.patientId, patientId), input.status === 'all' ? undefined : eq(medications.status, input.status)))
        .orderBy(desc(medications.createdAt)).limit(input.limit).offset((input.page - 1) * input.limit);
    },
    async findById(id: string) {
      const rows = await database.select().from(medications).where(eq(medications.id, id)).limit(1);
      return rows[0] ?? null;
    },
    async update(id: string, patientId: string, actorUserId: string, input: MedicationInput) {
      return database.transaction(async (transaction) => {
        const [medication] = await transaction.update(medications).set({ ...medicationValues(input), updatedAt: new Date() })
          .where(and(eq(medications.id, id), eq(medications.patientId, patientId))).returning();
        if (medication) await transaction.insert(auditLogs).values({ actorUserId, action: 'patient.medication.updated', resourceType: 'medication', resourceId: medication.id });
        return medication ?? null;
      });
    },
    async discontinue(id: string, patientId: string, actorUserId: string) {
      return database.transaction(async (transaction) => {
        const [medication] = await transaction.update(medications).set({ status: 'discontinued', discontinuedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(medications.id, id), eq(medications.patientId, patientId), eq(medications.status, 'active'))).returning();
        if (medication) await transaction.insert(auditLogs).values({ actorUserId, action: 'patient.medication.discontinued', resourceType: 'medication', resourceId: medication.id });
        return medication ?? null;
      });
    },
    async remove(id: string, patientId: string, actorUserId: string) {
      return database.transaction(async (transaction) => {
        const [medication] = await transaction.delete(medications).where(and(eq(medications.id, id), eq(medications.patientId, patientId))).returning();
        if (medication) await transaction.insert(auditLogs).values({ actorUserId, action: 'patient.medication.deleted', resourceType: 'medication', resourceId: medication.id });
        return medication ?? null;
      });
    },
    async listDoses(medicationId: string, patientId: string, input: DoseListInput) {
      return database.select().from(medicationDoses).where(and(
        eq(medicationDoses.medicationId, medicationId), eq(medicationDoses.patientId, patientId),
        input.from ? gte(medicationDoses.scheduledAt, input.from) : undefined,
        input.to ? lte(medicationDoses.scheduledAt, input.to) : undefined,
      )).orderBy(desc(medicationDoses.scheduledAt)).limit(input.limit).offset((input.page - 1) * input.limit);
    },
    async createDose(medicationId: string, patientId: string, actorUserId: string, input: DoseInput) {
      return database.transaction(async (transaction) => {
        const [dose] = await transaction.insert(medicationDoses).values({ medicationId, patientId, ...input, takenAt: input.takenAt ?? null }).returning();
        if (!dose) throw new Error('Medication dose insert returned no row.');
        await transaction.insert(auditLogs).values({ actorUserId, action: `patient.medication_dose.${input.status}`, resourceType: 'medication_dose', resourceId: dose.id });
        return dose;
      });
    },
    async updateDose(doseId: string, medicationId: string, patientId: string, actorUserId: string, input: DoseInput) {
      return database.transaction(async (transaction) => {
        const [dose] = await transaction.update(medicationDoses).set({
          ...input, takenAt: input.takenAt ?? null,
          actualDose: input.status === 'taken' ? input.actualDose : null,
          updatedAt: new Date(),
        })
          .where(and(eq(medicationDoses.id, doseId), eq(medicationDoses.medicationId, medicationId), eq(medicationDoses.patientId, patientId))).returning();
        if (dose) await transaction.insert(auditLogs).values({ actorUserId, action: `patient.medication_dose.${input.status}`, resourceType: 'medication_dose', resourceId: dose.id });
        return dose ?? null;
      });
    },
    async doseStats(medicationId: string, patientId: string) {
      const rows = await database.select({
        status: medicationDoses.status,
        count: sql<number>`count(*)::int`,
      }).from(medicationDoses).where(and(eq(medicationDoses.medicationId, medicationId), eq(medicationDoses.patientId, patientId))).groupBy(medicationDoses.status);
      return rows;
    },
  };
}
