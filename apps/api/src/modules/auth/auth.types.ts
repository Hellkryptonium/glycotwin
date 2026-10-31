import type { Environment } from '../../config/env.js';

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
}

export interface PatientProfileSummary {
  id: string;
  fullName: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  diabetesType: string | null;
}

export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
  iat: number;
  exp: number;
  jti: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthDependencies {
  environment: Environment;
  userService: UserService;
  userRepository: UserRepository;
  authRepository: AuthRepository;
  passwordHasher: PasswordHasher;
}

export interface UserService {
  registerDoctor(input: DoctorRegistrationInput, passwordHash: string): Promise<SafeUser>;
  registerPatient(input: PatientRegistrationInput, passwordHash: string): Promise<SafeUser>;
  getAuthenticatedUser(userId: string): Promise<AuthenticatedUser | null>;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
}

export interface AuthRepository {
  findRefreshTokenById(id: string): Promise<RefreshTokenRecord | null>;
  insertRefreshToken(input: NewRefreshToken): Promise<void>;
  revokeRefreshToken(id: string, revokedAt: Date): Promise<void>;
  revokeUserRefreshTokens(userId: string, revokedAt: Date): Promise<void>;
  rotateRefreshToken(oldId: string, newToken: NewRefreshToken, revokedAt: Date): Promise<boolean>;
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
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface NewRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface DoctorRegistrationInput {
  email: string;
  password: string;
}

export interface PatientRegistrationInput {
  email: string;
  password: string;
}

export interface AuthService {
  registerDoctor(input: unknown): Promise<SafeUser>;
  registerPatient(input: unknown): Promise<SafeUser>;
  login(email: string, password: string): Promise<AuthTokens>;
  refresh(rawToken: string): Promise<AuthTokens>;
  logout(rawToken: string, userId: string): Promise<void>;
  getCurrentUser(userId: string): Promise<AuthenticatedUser>;
  verifyAccessToken(token: string): Promise<AccessTokenClaims>;
}