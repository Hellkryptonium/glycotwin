import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { jwtVerify, SignJWT, type JWTPayload } from 'jose';
import { AppError } from '../../common/errors/app-error.js';
import type { Environment } from '../../config/env.js';
import { doctorRegistrationSchema, patientRegistrationSchema } from './auth.schema.js';
import type {
  AccessTokenClaims,
  AuthDependencies,
  AuthenticatedUser,
  AuthService,
  AuthTokens,
  DoctorRegistrationInput,
  NewRefreshToken,
  PatientRegistrationInput,
  SafeUser,
  UserRole,
} from './auth.types.js';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const genericAuthenticationError = () => new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
const invalidRefreshError = () => new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired.');

function secret(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function matchesHash(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashRefreshToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function parseRefreshToken(token: string): string | null {
  const tokenId = token.split('.')[0];
  return tokenId && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tokenId)
    ? tokenId
    : null;
}

function toAccessClaims(payload: JWTPayload): AccessTokenClaims {
  if (
    typeof payload.sub !== 'string'
    || !['doctor', 'patient', 'admin'].includes(String(payload.role))
    || typeof payload.iat !== 'number'
    || typeof payload.exp !== 'number'
    || typeof payload.jti !== 'string'
  ) {
    throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'Access token is invalid or expired.');
  }

  return {
    sub: payload.sub,
    role: payload.role as UserRole,
    iat: payload.iat,
    exp: payload.exp,
    jti: payload.jti,
  };
}

function createRefreshToken(userId: string): { raw: string; record: NewRefreshToken } {
  const id = randomUUID();
  const raw = `${id}.${randomBytes(48).toString('base64url')}`;
  return {
    raw,
    record: {
      id,
      userId,
      tokenHash: hashRefreshToken(raw),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  };
}

async function signAccessToken(user: SafeUser, environment: Environment): Promise<string> {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuer(environment.JWT_ISSUER)
    .setAudience(environment.JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .setJti(randomUUID())
    .sign(secret(environment.JWT_ACCESS_SECRET));
}

async function issueTokens(user: SafeUser, dependencies: AuthDependencies): Promise<AuthTokens> {
  const refresh = createRefreshToken(user.id);
  await dependencies.authRepository.insertRefreshToken(refresh.record);
  return {
    accessToken: await signAccessToken(user, dependencies.environment),
    refreshToken: refresh.raw,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };
}

export function createAuthService(dependencies: AuthDependencies): AuthService {
  return {
    async registerDoctor(input: unknown) {
      const parsed = doctorRegistrationSchema.parse(input);
      const passwordHash = await dependencies.passwordHasher.hash(parsed.password);
      return dependencies.userService.registerDoctor(parsed, passwordHash);
    },

    async registerPatient(input: unknown) {
      const parsed = patientRegistrationSchema.parse(input);
      const passwordHash = await dependencies.passwordHasher.hash(parsed.password);
      return dependencies.userService.registerPatient(parsed, passwordHash);
    },

    async login(email: string, password: string): Promise<AuthTokens> {
      const user = await dependencies.userRepository.findByEmail(email.toLowerCase().trim());
      if (!user || !user.isActive || !(await dependencies.passwordHasher.compare(password, user.passwordHash))) {
        throw genericAuthenticationError();
      }
      return issueTokens(user, dependencies);
    },

    async refresh(rawToken: string): Promise<AuthTokens> {
      const tokenId = parseRefreshToken(rawToken);
      if (!tokenId) {
        throw invalidRefreshError();
      }
      const stored = await dependencies.authRepository.findRefreshTokenById(tokenId);
      if (!stored || !matchesHash(rawToken, stored.tokenHash)) {
        throw invalidRefreshError();
      }
      if (stored.revokedAt) {
        await dependencies.authRepository.revokeUserRefreshTokens(stored.userId, new Date());
        throw invalidRefreshError();
      }
      if (stored.expiresAt.getTime() <= Date.now()) {
        await dependencies.authRepository.revokeRefreshToken(stored.id, new Date());
        throw invalidRefreshError();
      }

      const user = await dependencies.userRepository.findById(stored.userId);
      if (!user || !user.isActive) {
        throw invalidRefreshError();
      }

      const refresh = createRefreshToken(user.id);
      const rotated = await dependencies.authRepository.rotateRefreshToken(stored.id, refresh.record, new Date());
      if (!rotated) {
        await dependencies.authRepository.revokeUserRefreshTokens(stored.userId, new Date());
        throw invalidRefreshError();
      }
      return {
        accessToken: await signAccessToken(user, dependencies.environment),
        refreshToken: refresh.raw,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      };
    },

    async logout(rawToken: string, userId: string): Promise<void> {
      const tokenId = parseRefreshToken(rawToken);
      if (!tokenId) {
        return;
      }
      const stored = await dependencies.authRepository.findRefreshTokenById(tokenId);
      if (stored && stored.userId === userId && matchesHash(rawToken, stored.tokenHash)) {
        await dependencies.authRepository.revokeRefreshToken(stored.id, new Date());
      }
    },

    async getCurrentUser(userId: string): Promise<AuthenticatedUser> {
      const user = await dependencies.userService.getAuthenticatedUser(userId);
      if (!user || !user.isActive) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
      }
      return user;
    },

    async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
      try {
        const result = await jwtVerify(token, secret(dependencies.environment.JWT_ACCESS_SECRET), {
          issuer: dependencies.environment.JWT_ISSUER,
          audience: dependencies.environment.JWT_AUDIENCE,
          algorithms: ['HS256'],
        });
        return toAccessClaims(result.payload);
      } catch {
        throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'Access token is invalid or expired.');
      }
    },
  };
}

export function createBcryptPasswordHasher(rounds: number) {
  return {
    hash: (password: string) => bcrypt.hash(password, rounds),
    compare: (password: string, passwordHash: string) => bcrypt.compare(password, passwordHash),
  };
}