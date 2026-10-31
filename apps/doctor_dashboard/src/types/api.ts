export type UserRole = 'doctor' | 'patient' | 'admin';

export interface SafeUser {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  emailVerifiedAt: string | null;
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
}

export interface PatientProfileResponse {
  email: string;
  profile: PatientProfile;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
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

export interface GlucoseReading {
  id: string;
  patientId: string;
  value: string;
  unit: 'mg/dL' | 'mmol/L';
  measuredAt: string;
  context: 'FASTING' | 'BEFORE_MEAL' | 'AFTER_MEAL' | 'RANDOM';
  source: 'MANUAL';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GlucosePage {
  items: GlucoseReading[];
  page: number;
  limit: number;
}