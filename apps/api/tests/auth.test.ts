import { Router } from 'express';
import { SignJWT } from 'jose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { AppError } from '../src/common/errors/app-error.js';
import { createRequireAuth, createRequireRole } from '../src/middleware/auth.middleware.js';
import type { Database } from '../src/config/database.js';
import { loadEnvironment } from '../src/config/env.js';
import { doctorProfiles } from '../src/db/schema/profiles.js';
import { users } from '../src/db/schema/users.js';
import { createAuthController } from '../src/modules/auth/auth.controller.js';
import { createAuthRouter } from '../src/modules/auth/auth.routes.js';
import { createAuthService } from '../src/modules/auth/auth.service.js';
import { createUsersService } from '../src/modules/users/users.service.js';
import type {
  AuthRepository,
  AuthService,
  AuthenticatedUser,
  NewRefreshToken,
  RefreshTokenRecord,
  SafeUser,
  UserRecord,
  UserService,
} from '../src/modules/auth/auth.types.js';
import type { Environment } from '../src/config/env.js';

const environment: Environment = {
  NODE_ENV: 'test',
  DEMO_MODE: false,
  PORT: 5000,
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_ISSUER: 'glycotwin-api',
  JWT_AUDIENCE: 'glycotwin-clients',
  BCRYPT_ROUNDS: 10,
  FRONTEND_ORIGIN: 'http://localhost:3000',
};

function createHarness() {
  const users = new Map<string, UserRecord>();
  const refreshTokens = new Map<string, RefreshTokenRecord>();
  let nextId = 1;

  const userService: UserService = {
    async registerDoctor(input, passwordHash) {
      if ([...users.values()].some((user) => user.email === input.email)) {
        throw new AppError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.');
      }
      const user = createUser(input.email, passwordHash, 'doctor');
      users.set(user.id, user);
      return toSafeUser(user);
    },
    async registerPatient(input, passwordHash) {
      if ([...users.values()].some((user) => user.email === input.email)) {
        throw new AppError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.');
      }
      const user = createUser(input.email, passwordHash, 'patient');
      users.set(user.id, user);
      return toSafeUser(user);
    },
    async getAuthenticatedUser(userId): Promise<AuthenticatedUser | null> {
      const user = users.get(userId);
      return user ? { ...user, passwordHash: undefined as never } : null;
    },
  };

  function createUser(email: string, passwordHash: string, role: UserRecord['role']): UserRecord {
    const now = new Date();
    return {
      id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`,
      email,
      passwordHash,
      role,
      isActive: true,
      emailVerifiedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  function toSafeUser(user: UserRecord): SafeUser {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  const userRepository = {
    async findByEmail(email: string) {
      return [...users.values()].find((user) => user.email === email) ?? null;
    },
    async findById(id: string) {
      return users.get(id) ?? null;
    },
  };

  const authRepository: AuthRepository = {
    async findRefreshTokenById(id) {
      return refreshTokens.get(id) ?? null;
    },
    async insertRefreshToken(input: NewRefreshToken) {
      refreshTokens.set(input.id, { ...input, revokedAt: null, createdAt: new Date() });
    },
    async revokeRefreshToken(id, revokedAt) {
      const token = refreshTokens.get(id);
      if (token && !token.revokedAt) token.revokedAt = revokedAt;
    },
    async revokeUserRefreshTokens(userId, revokedAt) {
      for (const token of refreshTokens.values()) {
        if (token.userId === userId && !token.revokedAt) token.revokedAt = revokedAt;
      }
    },
    async rotateRefreshToken(oldId, input, revokedAt) {
      const oldToken = refreshTokens.get(oldId);
      if (!oldToken || oldToken.revokedAt) return false;
      oldToken.revokedAt = revokedAt;
      refreshTokens.set(input.id, { ...input, revokedAt: null, createdAt: new Date() });
      return true;
    },
  };

  const service = createAuthService({
    environment,
    userService,
    userRepository,
    authRepository,
    passwordHasher: {
      async hash(password) { return `hashed:${password}`; },
      async compare(password, hash) { return hash === `hashed:${password}`; },
    },
  });
  const authRouter = createAuthRouter(service, createRequireAuth(service));
  const app = createApp({ environment, authModule: { router: authRouter, service }, connectionRouter: null, databaseHealthCheck: async () => true });
  return { app, service, users, refreshTokens };
}

describe('authentication', () => {
  it('marks demo doctor profiles verified and keeps normal mode pending', async () => {
    async function registerWithMode(demoMode: boolean) {
      let profileInput: Record<string, unknown> | undefined;
      const user = {
        id: '00000000-0000-4000-8000-000000000006',
        email: `${demoMode ? 'demo' : 'normal'}@example.com`,
        passwordHash: 'hashed:password',
        role: 'doctor' as const,
        isActive: true,
        emailVerifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const executor = {
        insert(table: unknown) {
          if (table === users) {
            return { values: () => ({ returning: async () => [user] }) };
          }
          if (table === doctorProfiles) {
            return {
              values: (input: Record<string, unknown>) => {
                profileInput = input;
                return { returning: async () => [{ id: 'profile-id' }] };
              },
            };
          }
          throw new Error('unexpected table');
        },
      };
      const fakeDatabase = {
        transaction: async (callback: (transaction: typeof executor) => Promise<unknown>) => callback(executor),
      } as unknown as Database;
      await createUsersService(fakeDatabase, { demoMode }).registerDoctor({
        email: user.email,
        password: 'StrongPassword1',
      }, user.passwordHash);
      return profileInput;
    }

    expect((await registerWithMode(true))?.verificationStatus).toBe('verified');
    expect((await registerWithMode(false))?.verificationStatus).toBe('pending');
  });

  it('rejects production configuration with demo mode enabled', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalDemoMode = process.env.DEMO_MODE;
    process.env.NODE_ENV = 'production';
    process.env.DEMO_MODE = 'true';
    expect(() => loadEnvironment()).toThrow('DEMO_MODE=true is not allowed');
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalDemoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = originalDemoMode;
  });

  it('propagates profile creation failures so the account transaction rolls back', async () => {
    let rolledBack = false;
    const user = {
      id: '00000000-0000-4000-8000-000000000005',
      email: 'rollback@example.com',
      passwordHash: 'hashed:password',
      role: 'doctor' as const,
      isActive: true,
      emailVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const executor = {
      insert(table: unknown) {
        if (table === users) {
          return { values: () => ({ returning: async () => [user] }) };
        }
        if (table === doctorProfiles) {
          return { values: () => ({ returning: async () => { throw new Error('profile write failed'); } }) };
        }
        throw new Error('unexpected table');
      },
    };
    const fakeDatabase = {
      transaction: async (callback: (transaction: typeof executor) => Promise<unknown>) => {
        try {
          return await callback(executor);
        } catch (error) {
          rolledBack = true;
          throw error;
        }
      },
    } as unknown as Database;
    const service = createUsersService(fakeDatabase);

    await expect(service.registerDoctor({
      email: 'rollback@example.com',
      password: 'StrongPassword1',
    }, user.passwordHash)).rejects.toThrow('profile write failed');
    expect(rolledBack).toBe(true);
  });

  it('registers doctors as pending-profile accounts without returning hashes', async () => {
    const harness = createHarness();
    const response = await request(harness.app).post('/api/v1/auth/register/doctor').send({
      email: 'ADA@example.com',
      password: 'StrongPassword1',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.email).toBe('ada@example.com');
    expect(response.body.data.passwordHash).toBeUndefined();
  });

  it('registers patients and rejects duplicate email addresses', async () => {
    const harness = createHarness();
    const body = { email: 'patient@example.com', password: 'StrongPassword1' };
    expect((await request(harness.app).post('/api/v1/auth/register/patient').send(body)).status).toBe(201);
    const duplicate = await request(harness.app).post('/api/v1/auth/register/patient').send(body);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('rejects invalid registration input', async () => {
    const response = await request(createHarness().app).post('/api/v1/auth/register/patient').send({ email: 'bad' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('logs in with generic failures and returns a JWT with required claims', async () => {
    const harness = createHarness();
    await request(harness.app).post('/api/v1/auth/register/patient').send({
      email: 'patient@example.com', password: 'StrongPassword1',
    });
    const success = await request(harness.app).post('/api/v1/auth/login').send({
      email: 'PATIENT@example.com', password: 'StrongPassword1',
    });
    expect(success.status).toBe(200);
    expect(success.body.data.accessToken).toEqual(expect.any(String));
    expect(success.body.data.refreshToken).toEqual(expect.any(String));
    const failure = await request(harness.app).post('/api/v1/auth/login').send({
      email: 'missing@example.com', password: 'wrongpassword',
    });
    expect(failure.status).toBe(401);
    expect(failure.body.error.message).toBe('Invalid email or password.');
  });

  it('validates issuer, audience, and expiration on access tokens', async () => {
    const harness = createHarness();
    const user = {
      id: '00000000-0000-4000-8000-000000000001', email: 'user@example.com', role: 'patient' as const,
      isActive: true, emailVerifiedAt: null, createdAt: new Date(), updatedAt: new Date(), passwordHash: 'hashed:x',
    };
    harness.users.set(user.id, user);
    const tokens = await harness.service.login(user.email, 'x');
    const claims = await harness.service.verifyAccessToken(tokens.accessToken);
    expect(claims.sub).toBe(user.id);
    const expired = await new SignJWT({ role: 'patient' }).setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id).setIssuer(environment.JWT_ISSUER).setAudience(environment.JWT_AUDIENCE)
      .setIssuedAt(1).setExpirationTime(2).setJti('00000000-0000-4000-8000-000000000002')
      .sign(new TextEncoder().encode(environment.JWT_ACCESS_SECRET));
    await expect(harness.service.verifyAccessToken(expired)).rejects.toMatchObject({ code: 'INVALID_ACCESS_TOKEN' });
  });

  it('rotates refresh tokens and revokes the token family on reuse', async () => {
    const harness = createHarness();
    const user: UserRecord = {
      id: '00000000-0000-4000-8000-000000000003', email: 'user@example.com', role: 'patient',
      isActive: true, emailVerifiedAt: null, createdAt: new Date(), updatedAt: new Date(), passwordHash: 'hashed:x',
    };
    harness.users.set(user.id, user);
    const initial = await harness.service.login(user.email, 'x');
    const rotated = await harness.service.refresh(initial.refreshToken);
    expect(rotated.refreshToken).not.toBe(initial.refreshToken);
    await expect(harness.service.refresh(initial.refreshToken)).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    await expect(harness.service.refresh(rotated.refreshToken)).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  it('requires authentication for me, supports logout, and enforces roles', async () => {
    const harness = createHarness();
    const unauthorized = await request(harness.app).get('/api/v1/auth/me');
    expect(unauthorized.status).toBe(401);
    const user: UserRecord = {
      id: '00000000-0000-4000-8000-000000000004', email: 'user@example.com', role: 'patient',
      isActive: true, emailVerifiedAt: null, createdAt: new Date(), updatedAt: new Date(), passwordHash: 'hashed:x',
    };
    harness.users.set(user.id, user);
    const tokens = await harness.service.login(user.email, 'x');
    const roleRouter = Router();
    roleRouter.get('/role-check', createRequireAuth(harness.service), createRequireRole('doctor'), (_request, response) => response.json({ ok: true }));
    const roleApp = createApp({ environment, authModule: { router: createAuthRouter(harness.service, createRequireAuth(harness.service)), service: harness.service }, connectionRouter: null, additionalRoutes: roleRouter });
    const forbidden = await request(roleApp).get('/role-check').set('authorization', `Bearer ${tokens.accessToken}`);
    expect(forbidden.status).toBe(403);
    const logout = await request(harness.app).post('/api/v1/auth/logout').set('authorization', `Bearer ${tokens.accessToken}`).send({ refreshToken: tokens.refreshToken });
    expect(logout.status).toBe(204);
    await expect(harness.service.refresh(tokens.refreshToken)).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });
});