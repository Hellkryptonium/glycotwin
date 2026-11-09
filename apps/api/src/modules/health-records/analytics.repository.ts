import { sql } from 'drizzle-orm';
import type { Database } from '../../config/database.js';
import { glucoseReadings } from '../../db/schema/glucose-readings.js';
import type { AnalyticsInput, GlucoseAnalytics } from './analytics.types.js';

export function createAnalyticsRepository(database: Database) {
  return {
    async get(patientId: string, input: AnalyticsInput): Promise<GlucoseAnalytics> {
      const to = input.to ?? new Date();
      const from = input.from ?? new Date(to.getTime() - Number(input.range.slice(0, -1)) * 24 * 60 * 60 * 1000);
      const bounds = sql`WHERE ${glucoseReadings.patientId} = ${patientId}
        AND ${glucoseReadings.measuredAt} >= ${from.toISOString()}
        AND ${glucoseReadings.measuredAt} <= ${to.toISOString()}`;
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
        database.execute(sql`
          SELECT value::text, measured_at, unit
          FROM ${glucoseReadings} ${bounds}
          ORDER BY measured_at ASC, created_at ASC
        `),
      ]);
      const summaryRows = summary as unknown as Array<{ unit: GlucoseAnalytics['unit']; total_readings: number; average: string; minimum: string; maximum: string }>;
      const readingRows = readings as unknown as Array<{ value: string; measured_at: Date; unit: GlucoseAnalytics['unit'] }>;
      const dailyRows = daily as unknown as Array<{ date: string; unit: GlucoseAnalytics['unit']; reading_count: number; average: string }>;
      const latest = readingRows.at(-1) ?? null;
      const selectedSummary = summaryRows.length === 1 ? summaryRows[0] : null;
      return {
        range: input.range,
        from,
        to,
        unit: selectedSummary?.unit ?? null,
        latest: latest ? { value: latest.value, measuredAt: latest.measured_at, unit: latest.unit! } : null,
        totalReadings: readingRows.length,
        average: selectedSummary?.average ?? null,
        minimum: selectedSummary?.minimum ?? null,
        maximum: selectedSummary?.maximum ?? null,
        daily: dailyRows.map((row) => ({ date: row.date, average: row.average, readingCount: row.reading_count, unit: row.unit! })),
        readings: readingRows.map((row) => ({ value: row.value, measuredAt: row.measured_at, unit: row.unit! })),
        byUnit: summaryRows.map((row) => ({ unit: row.unit!, totalReadings: row.total_readings, average: row.average, minimum: row.minimum, maximum: row.maximum })),
      };
    },
  };
}
