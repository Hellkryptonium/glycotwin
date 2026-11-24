import type { Environment } from '../../config/env.js';
import type { DatabaseExecutor } from '../users/users.repository.js';

export type UserRole = 'doctor' | 'patient' | 'admin';

export interface SafeUser {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticatedUser extends SafeUser {
  doctorProfile?: DoctorProfileSummary;
  patientProfile?: PatientProfileSummary;
}

export interface DoctorProfileSummary {
  id: string;
  fullName: string | null;
  medicalRegistrationNumber: string | null;
  medicalCouncil: string | null;
  specialization: string | null;
  hospitalOrClinic: string | null;
  yearsOfExperience: number | null;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  profilePhotoAssetId?: string | null;
}

export interface PatientProfileSummary {
  id: string;
  fullName: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  diabetesType: string | null;
  treatmentContext?: 'INSULIN' | 'NON_INSULIN' | 'LIFESTYLE' | 'UNKNOWN' | null;
  profilePhotoAssetId?: string | null;
}

export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
  iat: number;
  exp: number;
  jti: string;
  sid?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sessionExpiresAt: Date;
}

export type AuthRegistration = SafeUser & AuthTokens;

export interface AuthDependencies {
  environment: Environment;
  userService: UserService;
  userRepository: UserRepository;
  authRepository: AuthRepository;
  passwordHasher: PasswordHasher;
}

export interface UserService {
  register<T>(
    role: 'doctor' | 'patient',
    email: string,
    passwordHash: string,
    complete: (transaction: DatabaseExecutor, user: SafeUser) => Promise<T>,
  ): Promise<T>;
  getAuthenticatedUser(userId: string): Promise<AuthenticatedUser | null>;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
}

export interface AuthRepository {
  findRefreshTokenById(id: string): Promise<RefreshTokenRecord | null>;
  insertInitialSession(transaction: DatabaseExecutor, input: NewRefreshToken): Promise<void>;
  insertRefreshToken(input: NewRefreshToken, expectedPasswordHash: string): Promise<boolean>;
  isSessionActive(sessionId: string, userId: string, now: Date): Promise<boolean>;
  revokeSession(sessionId: string, revokedAt: Date): Promise<void>;
  rotateRefreshToken(oldId: string, newToken: NewRefreshToken, revokedAt: Date): Promise<boolean>;
  deleteAccount(userId: string, expectedPasswordHash: string): Promise<void>;
  updatePassword(userId: string, expectedPasswordHash: string, passwordHash: string): Promise<boolean>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

export interface UserRecord extends SafeUser {
  passwordHash: string;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  sessionId: string | null;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface NewRefreshToken {
  id: string;
  userId: string;
  sessionId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface AuthService {
  registerDoctor(input: unknown): Promise<AuthRegistration>;
  registerPatient(input: unknown): Promise<AuthRegistration>;
  login(email: string, password: string): Promise<AuthTokens>;
  refresh(rawToken: string): Promise<AuthTokens>;
  logout(rawToken: string | null): Promise<void>;
  deleteAccount(userId: string, currentPassword: string): Promise<void>;
  changePassword(userId: string, input: { currentPassword: string; newPassword: string }): Promise<void>;
  getCurrentUser(userId: string): Promise<AuthenticatedUser>;
  verifyAccessToken(token: string): Promise<AccessTokenClaims>;
}
