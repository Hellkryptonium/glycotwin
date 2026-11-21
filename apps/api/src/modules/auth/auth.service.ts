import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { jwtVerify, SignJWT, type JWTPayload } from 'jose';
import { AppError } from '../../common/errors/app-error.js';
import type { Environment } from '../../config/env.js';
import { doctorRegistrationSchema, patientRegistrationSchema } from './auth.schema.js';
import type {
  AccessTokenClaims,
  AuthDependencies,
  AuthRegistration,
  AuthenticatedUser,
  AuthService,
  AuthTokens,
  NewRefreshToken,
  PasswordHasher,
  SafeUser,
  UserRole,
} from './auth.types.js';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_ROTATION_GRACE_MS = 10_000;
const genericAuthenticationError = () => new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
const invalidRefreshError = () => new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired.');
const rotatedRefreshError = () => new AppError(409, 'REFRESH_ALREADY_ROTATED', 'The session was just refreshed. Try again.');

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
    || typeof payload.sid !== 'string'
  ) {
    throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'Access token is invalid or expired.');
  }

  return {
    sub: payload.sub,
    role: payload.role as UserRole,
    iat: payload.iat,
    exp: payload.exp,
    jti: payload.jti,
    sid: payload.sid,
  };
}

function createRefreshToken(userId: string, sessionId: string, expiresAt: Date): { raw: string; record: NewRefreshToken } {
  const id = randomUUID();
  const raw = `${id}.${randomBytes(48).toString('base64url')}`;
  return {
    raw,
    record: {
      id,
      userId,
      sessionId,
      tokenHash: hashRefreshToken(raw),
      expiresAt,
    },
  };
}

async function signAccessToken(user: SafeUser, sessionId: string, expiresIn: number, environment: Environment): Promise<string> {
  return new SignJWT({ role: user.role, sid: sessionId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuer(environment.JWT_ISSUER)
    .setAudience(environment.JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .setJti(randomUUID())
    .sign(secret(environment.JWT_ACCESS_SECRET));
}

async function toTokens(user: SafeUser, refresh: ReturnType<typeof createRefreshToken>, environment: Environment): Promise<AuthTokens> {
  const expiresIn = Math.min(ACCESS_TOKEN_TTL_SECONDS, Math.ceil((refresh.record.expiresAt.getTime() - Date.now()) / 1000));
  if (expiresIn <= 0) throw invalidRefreshError();
  return {
    accessToken: await signAccessToken(user, refresh.record.sessionId, expiresIn, environment),
    refreshToken: refresh.raw,
    expiresIn,
    sessionExpiresAt: refresh.record.expiresAt,
  };
}

export function createAuthService(dependencies: AuthDependencies): AuthService {
  const { authRepository, passwordHasher, userRepository, environment } = dependencies;

  async function issueTokens(user: SafeUser, expectedPasswordHash: string) {
    const refresh = createRefreshToken(user.id, randomUUID(), new Date(Date.now() + SESSION_TTL_MS));
    if (!await authRepository.insertRefreshToken(refresh.record, expectedPasswordHash)) throw genericAuthenticationError();
    return toTokens(user, refresh, environment);
  }

  async function register(role: 'doctor' | 'patient', input: unknown): Promise<AuthRegistration> {
    const schema = role === 'doctor' ? doctorRegistrationSchema : patientRegistrationSchema;
    const { email, password } = schema.parse(input);
    const passwordHash = await passwordHasher.hash(password);
    return dependencies.userService.register(role, email, passwordHash, async (transaction, user) => {
      const refresh = createRefreshToken(user.id, randomUUID(), new Date(Date.now() + SESSION_TTL_MS));
      const tokens = await toTokens(user, refresh, environment);
      await authRepository.insertInitialSession(transaction, refresh.record);
      return { ...user, ...tokens };
    });
  }

  async function reauthenticate(userId: string, password: string) {
    const user = await userRepository.findById(userId);
    if (!user?.isActive) throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
    if (!await passwordHasher.compare(password, user.passwordHash)) {
      throw new AppError(403, 'INCORRECT_CURRENT_PASSWORD', 'The current password is incorrect.');
    }
    return user;
  }

  return {
    registerDoctor(input: unknown) {
      return register('doctor', input);
    },

    registerPatient(input: unknown) {
      return register('patient', input);
    },

    async login(email: string, password: string): Promise<AuthTokens> {
      const user = await dependencies.userRepository.findByEmail(email.toLowerCase().trim());
      if (!user || !user.isActive || !(await dependencies.passwordHasher.compare(password, user.passwordHash))) {
        throw genericAuthenticationError();
      }
      return issueTokens(user, user.passwordHash);
    },

    async refresh(rawToken: string): Promise<AuthTokens> {
      const tokenId = parseRefreshToken(rawToken);
      if (!tokenId) {
        throw invalidRefreshError();
      }
      const stored = await dependencies.authRepository.findRefreshTokenById(tokenId);
      if (!stored?.sessionId || !matchesHash(rawToken, stored.tokenHash)) {
        throw invalidRefreshError();
      }
      const now = new Date();
      if (stored.expiresAt <= now || !await authRepository.isSessionActive(stored.sessionId, stored.userId, now)) {
        throw invalidRefreshError();
      }
      if (stored.revokedAt) {
        if (now.getTime() - stored.revokedAt.getTime() < TOKEN_ROTATION_GRACE_MS) throw rotatedRefreshError();
        await authRepository.revokeSession(stored.sessionId, now);
        throw invalidRefreshError();
      }

      const user = await dependencies.userRepository.findById(stored.userId);
      if (!user || !user.isActive) {
        throw invalidRefreshError();
      }

      const refresh = createRefreshToken(user.id, stored.sessionId, stored.expiresAt);
      if (!await authRepository.rotateRefreshToken(stored.id, refresh.record, now)) {
        if (!await authRepository.isSessionActive(stored.sessionId, user.id, new Date())) throw invalidRefreshError();
        throw rotatedRefreshError();
      }
      return toTokens(user, refresh, environment);
    },

    async logout(rawToken) {
      const tokenId = rawToken && parseRefreshToken(rawToken);
      if (!tokenId) {
        return;
      }
      const stored = await authRepository.findRefreshTokenById(tokenId);
      if (rawToken && stored?.sessionId && matchesHash(rawToken, stored.tokenHash)) {
        await authRepository.revokeSession(stored.sessionId, new Date());
      }
    },

    async deleteAccount(userId, currentPassword) {
      const user = await reauthenticate(userId, currentPassword);
      await authRepository.deleteAccount(user.id, user.passwordHash);
    },

    async changePassword(userId, input) {
      const user = await reauthenticate(userId, input.currentPassword);
      if (!await authRepository.updatePassword(user.id, user.passwordHash, await passwordHasher.hash(input.newPassword))) {
        throw new AppError(403, 'INCORRECT_CURRENT_PASSWORD', 'The current password is incorrect.');
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
      let claims: AccessTokenClaims;
      try {
        const result = await jwtVerify(token, secret(dependencies.environment.JWT_ACCESS_SECRET), {
          issuer: dependencies.environment.JWT_ISSUER,
          audience: dependencies.environment.JWT_AUDIENCE,
          algorithms: ['HS256'],
        });
        claims = toAccessClaims(result.payload);
      } catch {
        throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'Access token is invalid or expired.');
      }
      if (!claims.sid || !await authRepository.isSessionActive(claims.sid, claims.sub, new Date())) {
        throw new AppError(401, 'INVALID_ACCESS_TOKEN', 'The session has ended. Sign in again.');
      }
      return claims;
    },
  };
}

function derivePassword(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export function createPasswordHasher(): PasswordHasher {
  return {
    async hash(password) {
      const salt = randomBytes(16);
      const key = await derivePassword(password, salt);
      return `scrypt-v1$${salt.toString('base64url')}$${key.toString('base64url')}`;
    },
    async compare(password, passwordHash) {
      if (passwordHash.startsWith('$2')) return bcrypt.compare(password, passwordHash);
      const [format, salt, key] = passwordHash.split('$');
      if (format !== 'scrypt-v1' || !salt || !key) return false;
      const expected = Buffer.from(key, 'base64url');
      const actual = await derivePassword(password, Buffer.from(salt, 'base64url'));
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    },
  };
}
