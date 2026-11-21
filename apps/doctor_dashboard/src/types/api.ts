export type UserRole = 'doctor' | 'patient' | 'admin';

export interface SafeUser {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  doctorProfile?: DoctorProfile;
  patientProfile?: PatientProfile;
}

export interface DoctorProfile {
  id: string;
  fullName: string | null;
  medicalRegistrationNumber: string | null;
  medicalCouncil: string | null;
  specialization: string | null;
  hospitalOrClinic: string | null;
  yearsOfExperience: number | null;
  verificationStatus: 'pending' | 'verified' | 'rejected';
}

export interface PatientProfile {
  id: string;
  fullName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  diabetesType: string | null;
  treatmentContext?: 'INSULIN' | 'NON_INSULIN' | 'LIFESTYLE' | 'UNKNOWN' | null;
}

export interface PatientProfileResponse {
  email: string;
  profile: PatientProfile;
}

export interface BrowserSession {
  accessToken: string;
  expiresIn: number;
  sessionExpiresAt: string;
  user?: SafeUser;
}

export interface DoctorProfileUpdate {
  fullName: string;
  specialization: string | null;
  hospitalOrClinic: string | null;
  medicalRegistrationNumber: string | null;
  medicalCouncil: string | null;
  yearsOfExperience: number | null;
}

export interface PatientSearchResult {
  patientId: string;
  email: string;
  fullName: string | null;
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';

export interface Invitation {
  id: string;
  status: InvitationStatus;
  expiresAt: string;
  respondedAt: string | null;
  createdAt: string;
  doctor: { id: string; fullName: string | null };
}

export interface ConnectionPage {
  items: ConnectedPatient[];
  page: number;
  limit: number;
}

export interface ConnectedPatient {
  relationshipId: string;
  patientId: string;
  fullName: string | null;
  connectedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
  requestId?: string;
}

export interface ApiErrorShape {
  code: string;
  message: string;
  requestId?: string;
  status?: number;
}

export type GlucoseSource = 'MANUAL' | 'CGM' | 'HEALTH_CONNECT' | 'REPLAY';

export interface GlucoseReading {
  id: string;
  patientId: string;
  value: string;
  unit: 'mg/dL' | 'mmol/L';
  measuredAt: string;
  receivedAt?: string | null;
  context: 'FASTING' | 'BEFORE_MEAL' | 'AFTER_MEAL' | 'RANDOM';
  source: GlucoseSource;
  deviceOrigin?: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GlucosePage {
  items: GlucoseReading[];
  page: number;
  limit: number;
}

export type AnalyticsRange = '7d' | '30d' | '90d';

export interface GlucoseAnalyticsReading {
  value: string;
  measuredAt: string;
  unit: GlucoseReading['unit'];
  source?: GlucoseSource;
  receivedAt?: string | null;
  deviceOrigin?: string | null;
}

export interface GlucoseAnalytics {
  range: AnalyticsRange;
  from: string;
  to: string;
  unit: 'mg/dL' | 'mmol/L' | null;
  latest: GlucoseAnalyticsReading | null;
  totalReadings: number;
  average: string | null;
  minimum: string | null;
  maximum: string | null;
  daily: Array<{ date: string; average: string; readingCount: number; unit: 'mg/dL' | 'mmol/L' }>;
  readings: GlucoseAnalyticsReading[];
  byUnit: Array<{ unit: 'mg/dL' | 'mmol/L'; totalReadings: number; average: string; minimum: string; maximum: string }>;
}

export interface LifestyleEntry {
  id: string;
  patientId: string;
  type: 'meal' | 'activity' | 'sleep' | 'symptom';
  occurredAt: string;
  mealType: string | null;
  carbohydrateGrams?: number | null;
  description: string | null;
  activityType: string | null;
  durationMinutes: number | null;
  sleepDurationMinutes: number | null;
  notes: string | null;
}

export interface LifestylePage {
  items: LifestyleEntry[];
  page: number;
  limit: number;
}

export type TimelineSource = GlucoseSource | 'WATCH';
export type TimelineKind = 'glucose' | 'meal' | 'activity' | 'sleep' | 'symptom' | 'medication' | 'steps' | 'workout' | 'heart_rate';

export interface TimelineEntry {
  id: string;
  kind: TimelineKind;
  occurredAt: string;
  receivedAt: string;
  source: TimelineSource;
  title: string;
  detail: string | null;
  deviceOrigin?: string | null;
  glucose?: { value: string; unit: string };
}

export interface TimelineFilters {
  page: number;
  limit: number;
  from?: string;
  to?: string;
  source?: TimelineSource;
}

export interface TimelinePage {
  items: TimelineEntry[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export type CareItemKind = 'NOTE' | 'GOAL' | 'FOLLOW_UP';

export interface CareItemInput {
  kind: CareItemKind;
  title: string;
  detail?: string | null;
  dueDate?: string | null;
  status?: 'OPEN' | 'DONE';
}

export interface CareItem extends CareItemInput {
  id: string;
  detail: string | null;
  dueDate: string | null;
  status: 'OPEN' | 'DONE';
  createdAt: string;
  updatedAt: string;
}

export interface SharedVisitBrief {
  id: string;
  relationshipId: string;
  title: string;
  notes: string | null;
  events: TimelineEntry[];
  createdAt: string;
}

export interface DoctorCareResponse {
  items: CareItem[];
  briefs: SharedVisitBrief[];
}

export interface Medication {
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  frequency: string;
  scheduleTimes: string[];
  startDate: string;
  endDate: string | null;
  instructions: string | null;
  status: 'active' | 'discontinued';
}
export interface MedicationPage { items: Medication[]; page: number; limit: number; }
export interface MedicationDose {
  id: string;
  medicationId: string;
  patientId: string;
  scheduledAt: string;
  takenAt: string | null;
  status: 'taken' | 'skipped' | 'missed';
}
export interface MedicationDosePage {
  items: MedicationDose[];
  page: number;
  limit: number;
  stats: Array<{ status: MedicationDose['status']; count: number }>;
}
