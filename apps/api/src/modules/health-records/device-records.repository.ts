import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { Database } from '../../config/database.js';
import { auditLogs, deviceActivity, glucoseReadings, lifestyleEntries, medicationDoses, medications, doctorPatientRelationships } from '../../db/schema/index.js';
import type { DeviceActivityEvent, GlucoseImportRow, TimelineInput } from './device-records.schema.js';
import type { GlucoseUnit } from './glucose.types.js';

type TimelineRow = {
  id: string;
  kind: 'glucose' | 'meal' | 'activity' | 'sleep' | 'symptom' | 'medication' | DeviceActivityEvent['kind'];
  occurredAt: string;
  receivedAt: string;
  source: NonNullable<TimelineInput['source']>;
  title: string;
  detail: string | null;
  glucose: { value: string; unit: GlucoseUnit } | null;
  deviceOrigin: string | null;
};

export function createDeviceRecordsRepository(database: Database) {
  return {
    async insertGlucose(patientId: string, userId: string, source: 'HEALTH_CONNECT' | 'REPLAY', readings: GlucoseImportRow[]) {
      const inserted = await database.transaction(async (transaction) => {
        const records = await transaction.insert(glucoseReadings)
          .values(readings.map((reading) => ({ ...reading, patientId, source, context: 'RANDOM' as const })))
          .onConflictDoNothing({ target: [glucoseReadings.patientId, glucoseReadings.source, glucoseReadings.externalId] })
          .returning({ id: glucoseReadings.id });
        if (records.length) await transaction.insert(auditLogs).values({
          actorUserId: userId, action: 'patient.glucose_readings.imported', resourceType: 'patient_profile', resourceId: patientId,
        });
        return records.length;
      });
      return { inserted, duplicates: readings.length - inserted };
    },

    async insertActivity(patientId: string, userId: string, events: DeviceActivityEvent[]) {
      const inserted = await database.transaction(async (transaction) => {
        const records = await transaction.insert(deviceActivity).values(events.map((event) => ({
          patientId,
          externalId: event.eventId,
          kind: event.kind,
          measuredAt: event.measuredAt,
          startedAt: 'startedAt' in event ? event.startedAt : undefined,
          value: 'value' in event ? event.value : undefined,
          activityType: 'activityType' in event ? event.activityType : undefined,
          source: event.simulated ? 'REPLAY' : 'WATCH',
        }))).onConflictDoNothing({ target: [deviceActivity.patientId, deviceActivity.externalId] })
          .returning({ id: deviceActivity.id });
        if (records.length) await transaction.insert(auditLogs).values({
          actorUserId: userId, action: 'patient.device_activity.imported', resourceType: 'patient_profile', resourceId: patientId,
        });
        return records.length;
      });
      return { inserted, duplicates: events.length - inserted };
    },

    async timeline(patientId: string, input: TimelineInput, doctorId?: string, selectedIds?: string[]) {
      const permitted = doctorId ? sql`EXISTS (
        SELECT 1 FROM ${doctorPatientRelationships}
        WHERE patient_id = ${patientId} AND doctor_id = ${doctorId} AND status = 'active'
      )` : sql`true`;
      const bounds = (patientColumn: AnyPgColumn, timeColumn: AnyPgColumn) => sql`
        ${patientColumn} = ${patientId}
        ${input.from ? sql`AND ${timeColumn} >= ${input.from}::timestamptz` : sql``}
        ${input.to ? sql`AND ${timeColumn} <= ${input.to}::timestamptz` : sql``}
      `;
      const selection = selectedIds?.length
        ? sql`AND id IN (${sql.join(selectedIds.map((id) => sql`${id}::uuid`), sql`, `)})`
        : sql``;
      const rows = await database.execute<TimelineRow>(sql`
        SELECT id, kind, occurred_at AS "occurredAt", received_at AS "receivedAt", source, title, detail, glucose,
          device_origin AS "deviceOrigin"
        FROM (
          SELECT id, 'glucose'::text AS kind, measured_at AS occurred_at, created_at AS received_at,
            source::text, 'Glucose reading'::text AS title,
            CASE WHEN source = 'MANUAL' THEN notes END AS detail,
            jsonb_build_object('value', value::text, 'unit', unit) AS glucose, device_origin
          FROM ${glucoseReadings}
          WHERE ${bounds(glucoseReadings.patientId, glucoseReadings.measuredAt)}
          UNION ALL
          SELECT id, type, occurred_at, created_at, 'MANUAL',
            CASE type WHEN 'meal' THEN 'Meal' WHEN 'activity' THEN 'Activity' WHEN 'sleep' THEN 'Sleep' ELSE 'Symptom' END,
            NULLIF(concat_ws(' · ', meal_type, description,
              CASE WHEN carbohydrate_grams IS NOT NULL THEN carbohydrate_grams || ' g carbs' END,
              activity_type, CASE WHEN duration_minutes IS NOT NULL THEN duration_minutes || ' min' END,
              CASE WHEN sleep_duration_minutes IS NOT NULL THEN sleep_duration_minutes || ' min' END, notes), ''),
            NULL, NULL
          FROM ${lifestyleEntries}
          WHERE ${bounds(lifestyleEntries.patientId, lifestyleEntries.occurredAt)}
          UNION ALL
          SELECT ${medicationDoses.id}, 'medication', ${medicationDoses.takenAt}, ${medicationDoses.createdAt}, 'MANUAL',
            ${medications.name}, concat_ws(' · ', 'Taken dose', ${medicationDoses.actualDose}), NULL, NULL
          FROM ${medicationDoses} JOIN ${medications} ON ${medicationDoses.medicationId} = ${medications.id}
          WHERE ${bounds(medicationDoses.patientId, medicationDoses.takenAt)}
            AND ${medicationDoses.status} = 'taken' AND ${medicationDoses.takenAt} IS NOT NULL
          UNION ALL
          SELECT id, kind, measured_at, received_at, source,
            CASE kind WHEN 'steps' THEN 'Steps' WHEN 'heart_rate' THEN 'Heart rate' ELSE 'Workout' END,
            CASE kind WHEN 'steps' THEN value || ' steps' WHEN 'heart_rate' THEN value || ' bpm'
              ELSE activity_type || ' · ' || round(extract(epoch FROM (measured_at - started_at)) / 60, 1) || ' min' END,
            NULL, NULL
          FROM ${deviceActivity}
          WHERE ${bounds(deviceActivity.patientId, deviceActivity.measuredAt)}
        ) AS events
        WHERE ${permitted} ${input.source ? sql`AND source = ${input.source}` : sql``} ${selection}
        ORDER BY occurred_at DESC, received_at DESC, kind, id DESC
        LIMIT ${input.limit + 1} OFFSET ${(input.page - 1) * input.limit}
      `);
      return {
        items: rows.slice(0, input.limit).map((row) => ({
          ...row,
          occurredAt: new Date(row.occurredAt).toISOString(),
          receivedAt: new Date(row.receivedAt).toISOString(),
          glucose: row.glucose ?? undefined,
        })),
        hasMore: rows.length > input.limit, page: input.page, limit: input.limit,
      };
    },
  };
}
