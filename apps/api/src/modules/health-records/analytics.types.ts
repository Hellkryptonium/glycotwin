import type { GlucoseUnit } from './glucose.types.js';

export type AnalyticsRange = '7d' | '30d' | '90d';

export interface AnalyticsInput {
  range: AnalyticsRange;
  from?: Date;
  to?: Date;
}

export interface GlucoseAnalytics {
  range: AnalyticsRange;
  from: Date;
  to: Date;
  unit: GlucoseUnit | null;
  latest: { value: string; measuredAt: Date; unit: GlucoseUnit } | null;
  totalReadings: number;
  average: string | null;
  minimum: string | null;
  maximum: string | null;
  daily: Array<{ date: string; average: string; readingCount: number; unit: GlucoseUnit }>;
  readings: Array<{ value: string; measuredAt: Date; unit: GlucoseUnit }>;
  byUnit: Array<{
    unit: GlucoseUnit;
    totalReadings: number;
    average: string;
    minimum: string;
    maximum: string;
  }>;
}
