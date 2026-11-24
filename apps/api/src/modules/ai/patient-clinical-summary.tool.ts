import { and, desc, eq, gte } from 'drizzle-orm';
import type { Database } from '../../config/database.js';
import { careItems, doctorPatientRelationships, doctorProfiles, glucoseReadings, lifestyleEntries, medications } from '../../db/schema/index.js';
import type { GetPatientProfileTool, PatientProfileForAgent } from './patient-profile.tool.js';

export interface PatientClinicalSummary {
  profile: PatientProfileForAgent;
  glucoseLast30Days: {
    totalReadings: number;
    byUnit: Array<{ unit: string; average: string; minimum: string; maximum: string; latestMeasuredAt: Date }>;
  };
  activeMedications: Array<{ name: string; dosage: string; frequency: string; status: string }>;
  lifestyleLast30Days: Array<{ type: string; count: number }>;
  openCareItems: Array<{ kind: string; title: string; dueDate: string | null; status: string }>;
}

export interface PatientClinicalSummaryTool {
  getPatientClinicalSummary(doctorUserId: string, patientProfileId: string): Promise<PatientClinicalSummary>;
}

export function createPatientClinicalSummaryTool(
  database: Database,
  patientProfileTool: GetPatientProfileTool,
): PatientClinicalSummaryTool {
  return {
    async getPatientClinicalSummary(doctorUserId, patientProfileId) {
      // Authorization happens before every tool read; no model-supplied identity is trusted.
      const profile = await patientProfileTool.getPatientProfile(doctorUserId, patientProfileId);
      const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [readings, activeMedications, lifestyle, care] = await Promise.all([
        database.select({ value: glucoseReadings.value, unit: glucoseReadings.unit, measuredAt: glucoseReadings.measuredAt })
          .from(glucoseReadings).where(and(eq(glucoseReadings.patientId, patientProfileId), gte(glucoseReadings.measuredAt, from)))
          .orderBy(desc(glucoseReadings.measuredAt)).limit(500),
        database.select({ name: medications.name, dosage: medications.dosage, frequency: medications.frequency, status: medications.status })
          .from(medications).where(and(eq(medications.patientId, patientProfileId), eq(medications.status, 'active'))).limit(30),
        database.select({ type: lifestyleEntries.type }).from(lifestyleEntries)
          .where(and(eq(lifestyleEntries.patientId, patientProfileId), gte(lifestyleEntries.occurredAt, from))).limit(500),
        database.select({ kind: careItems.kind, title: careItems.title, dueDate: careItems.dueDate, status: careItems.status })
          .from(careItems).innerJoin(doctorPatientRelationships, eq(careItems.relationshipId, doctorPatientRelationships.id))
          .innerJoin(doctorProfiles, eq(doctorPatientRelationships.doctorId, doctorProfiles.id))
          .where(and(eq(doctorPatientRelationships.patientId, patientProfileId), eq(doctorProfiles.userId, doctorUserId), eq(careItems.status, 'OPEN')))
          .orderBy(desc(careItems.updatedAt)).limit(30),
      ]);
      const units = new Map<string, Array<{ value: string; measuredAt: Date }>>();
      for (const reading of readings) {
        const values = units.get(reading.unit) ?? [];
        values.push({ value: reading.value, measuredAt: reading.measuredAt });
        units.set(reading.unit, values);
      }
      const byUnit = [...units.entries()].map(([unit, values]) => {
        const numeric = values.map((entry) => Number(entry.value)).filter(Number.isFinite);
        return {
          unit,
          average: (numeric.reduce((total, value) => total + value, 0) / numeric.length).toFixed(2),
          minimum: Math.min(...numeric).toString(),
          maximum: Math.max(...numeric).toString(),
          latestMeasuredAt: values[0]!.measuredAt,
        };
      });
      const lifestyleCounts = new Map<string, number>();
      for (const entry of lifestyle) lifestyleCounts.set(entry.type, (lifestyleCounts.get(entry.type) ?? 0) + 1);
      return {
        profile,
        glucoseLast30Days: { totalReadings: readings.length, byUnit },
        activeMedications,
        lifestyleLast30Days: [...lifestyleCounts].map(([type, count]) => ({ type, count })),
        openCareItems: care.map((item) => ({ ...item, dueDate: item.dueDate ?? null })),
      };
    },
  };
}
