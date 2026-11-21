export type GlucoseUnit = 'mg/dL' | 'mmol/L';
export type GlucoseContext = 'FASTING' | 'BEFORE_MEAL' | 'AFTER_MEAL' | 'RANDOM';
export type GlucoseSource = 'MANUAL' | 'CGM' | 'REPLAY' | 'HEALTH_CONNECT';

export interface GlucoseReading {
  id: string;
  patientId: string;
  value: string;
  unit: GlucoseUnit;
  measuredAt: Date;
  context: GlucoseContext;
  source: GlucoseSource;
  externalId?: string | null;
  deviceOrigin?: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GlucoseListInput {
  page: number;
  limit: number;
  from?: Date;
  to?: Date;
  context?: GlucoseContext;
  source?: GlucoseSource;
}
