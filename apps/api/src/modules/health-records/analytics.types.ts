import type { GlucoseSource, GlucoseUnit } from './glucose.types.js';

export type AnalyticsRange = '7d' | '30d' | '90d';

export interface AnalyticsInput {
  range: AnalyticsRange;
  from?: Date;
  to?: Date;
}

type AnalyticsReading = {
  value: string;
  measuredAt: Date;
  receivedAt: Date;
  source: GlucoseSource;
  deviceOrigin: string | null;
  unit: GlucoseUnit;
};

export interface GlucoseAnalytics {
  range: AnalyticsRange;
  from: Date;
  to: Date;
  unit: GlucoseUnit | null;
  latest: AnalyticsReading | null;
  totalReadings: number;
  average: string | null;
  minimum: string | null;
  maximum: string | null;
  daily: Array<{ date: string; average: string; readingCount: number; unit: GlucoseUnit }>;
  readings: AnalyticsReading[];
  byUnit: Array<{
    unit: GlucoseUnit;
    totalReadings: number;
    average: string;
    minimum: string;
    maximum: string;
  }>;
}
