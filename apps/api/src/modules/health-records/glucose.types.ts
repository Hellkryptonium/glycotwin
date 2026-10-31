export type GlucoseUnit = 'mg/dL' | 'mmol/L';
export type GlucoseContext = 'FASTING' | 'BEFORE_MEAL' | 'AFTER_MEAL' | 'RANDOM';

export interface GlucoseReading {
  id: string;
  patientId: string;
  value: string;
  unit: GlucoseUnit;
  measuredAt: Date;
  context: GlucoseContext;
  source: 'MANUAL';
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
}
