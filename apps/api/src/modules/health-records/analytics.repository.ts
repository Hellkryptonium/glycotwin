import { sql } from 'drizzle-orm';
import type { Database } from '../../config/database.js';
import { glucoseReadings } from '../../db/schema/glucose-readings.js';
import type { GlucoseUnit } from './glucose.types.js';
import type { AnalyticsInput, GlucoseAnalytics } from './analytics.types.js';

export function createAnalyticsRepository(database: Database) {
  return {
    async get(patientId: string, input: AnalyticsInput): Promise<GlucoseAnalytics> {
      const to = input.to ?? new Date();
      const from = input.from ?? new Date(to.getTime() - Number(input.range.slice(0, -1)) * 24 * 60 * 60 * 1000);
      const bounds = sql`WHERE ${glucoseReadings.patientId} = ${patientId}
        AND ${glucoseReadings.measuredAt} >= ${from.toISOString()}
        AND ${glucoseReadings.measuredAt} <= ${to.toISOString()}
        AND ${glucoseReadings.source} <> 'REPLAY'`;
      const [summary, daily, readings] = await Promise.all([
        database.execute(sql`
          SELECT unit, COUNT(*)::int AS total_readings,
            ROUND(AVG(value), 4)::text AS average,
            MIN(value)::text AS minimum, MAX(value)::text AS maximum
          FROM ${glucoseReadings} ${bounds}
          GROUP BY unit ORDER BY unit
        `),
        database.execute(sql`
          SELECT TO_CHAR(DATE_TRUNC('day', measured_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
            unit, COUNT(*)::int AS reading_count, ROUND(AVG(value), 4)::text AS average
          FROM ${glucoseReadings} ${bounds}
          GROUP BY date, unit ORDER BY date ASC, unit ASC
        `),
        database.execute<Omit<GlucoseAnalytics['readings'][number], 'measuredAt' | 'receivedAt'> & {
          measuredAt: string; receivedAt: string;
        }>(sql`
          SELECT value::text, measured_at AS "measuredAt", created_at AS "receivedAt",
            unit, source, device_origin AS "deviceOrigin"
          FROM ${glucoseReadings} ${bounds}
          ORDER BY measured_at ASC, created_at ASC, id ASC
        `),
      ]);
      const summaryRows = summary as unknown as Array<{ unit: GlucoseUnit; total_readings: number; average: string; minimum: string; maximum: string }>;
      const dailyRows = daily as unknown as Array<{ date: string; unit: GlucoseUnit; reading_count: number; average: string }>;
      const readingRows = readings.map((row) => ({ ...row, measuredAt: new Date(row.measuredAt), receivedAt: new Date(row.receivedAt) }));
      const selectedSummary = summaryRows.length === 1 ? summaryRows[0] : null;
      return {
        range: input.range,
        from,
        to,
        unit: selectedSummary?.unit ?? null,
        latest: readingRows.at(-1) ?? null,
        totalReadings: readings.length,
        average: selectedSummary?.average ?? null,
        minimum: selectedSummary?.minimum ?? null,
        maximum: selectedSummary?.maximum ?? null,
        daily: dailyRows.map((row) => ({ date: row.date, average: row.average, readingCount: row.reading_count, unit: row.unit })),
        readings: readingRows,
        byUnit: summaryRows.map((row) => ({ unit: row.unit, totalReadings: row.total_readings, average: row.average, minimum: row.minimum, maximum: row.maximum })),
      };
    },
  };
}
