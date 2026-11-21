import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { AppError } from '../src/common/errors/app-error.js';
import { createRequireAuth, createRequireRole } from '../src/middleware/auth.middleware.js';
import type { Database } from '../src/config/database.js';
import { loadEnvironment } from '../src/config/env.js';
import { doctorProfiles } from '../src/db/schema/profiles.js';
import { authSessions } from '../src/db/schema/account-security.js';
import { refreshTokens as refreshTokenTable } from '../src/db/schema/refresh-tokens.js';
import { users } from '../src/db/schema/users.js';
import { createAuthController } from '../src/modules/auth/auth.controller.js';
import { createAuthRepository } from '../src/modules/auth/auth.repository.js';
import { createAuthRouter } from '../src/modules/auth/auth.routes.js';
import { createAuthService, createPasswordHasher } from '../src/modules/auth/auth.service.js';
import { createUsersService } from '../src/modules/users/users.service.js';
import { createUsersRepository, type DatabaseExecutor } from '../src/modules/users/users.repository.js';
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
  DEMO_MODE: false, AUTO_APPROVE_DOCTOR_SIGNUPS: false,
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
  const sessions = new Map<string, { userId: string; expiresAt: Date; revokedAt: Date | null }>();
  let nextId = 1;

  const userService: UserService = {
    async register(role, email, passwordHash, complete) {
      if ([...users.values()].some((user) => user.email === email)) {
        throw new AppError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.');
      }
      const user = createUser(email, passwordHash, role);
      const result = await complete({} as DatabaseExecutor, toSafeUser(user));
      users.set(user.id, user);
      return result;
    },
    async getAuthenticatedUser(userId): Promise<AuthenticatedUser | null> {
      const user = users.get(userId);
      return user ? toSafeUser(user) : null;
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
    async insertInitialSession(_transaction, input) {
      sessions.set(input.sessionId, { userId: input.userId, expiresAt: input.expiresAt, revokedAt: null });
      refreshTokens.set(input.id, { ...input, revokedAt: null, createdAt: new Date() });
    },
    async insertRefreshToken(input: NewRefreshToken, expectedPasswordHash) {
      if (users.get(input.userId)?.passwordHash !== expectedPasswordHash) return false;
      sessions.set(input.sessionId, { userId: input.userId, expiresAt: input.expiresAt, revokedAt: null });
      refreshTokens.set(input.id, { ...input, revokedAt: null, createdAt: new Date() });
      return true;
    },
    async isSessionActive(id, userId, now) {
      const session = sessions.get(id);
      return !!session && session.userId === userId && !session.revokedAt && session.expiresAt > now && !!users.get(userId)?.isActive;
    },
    async revokeSession(id, revokedAt) {
      const session = sessions.get(id);
      if (session) session.revokedAt = revokedAt;
    },
    async rotateRefreshToken(oldId, input, revokedAt) {
      const oldToken = refreshTokens.get(oldId);
      if (!oldToken || oldToken.revokedAt) return false;
      oldToken.revokedAt = revokedAt;
      refreshTokens.set(input.id, { ...input, revokedAt: null, createdAt: new Date() });
      return true;
    },
    async deleteAccount(userId) {
      users.delete(userId);
      for (const [id, token] of refreshTokens.entries()) {
        if (token.userId === userId) refreshTokens.delete(id);
      }
    },
    async updatePassword(userId, expectedPasswordHash, passwordHash) {
      const user = users.get(userId);
      if (!user || user.passwordHash !== expectedPasswordHash) return false;
      user.passwordHash = passwordHash;
      for (const session of sessions.values()) {
        if (session.userId === userId) session.revokedAt = new Date();
      }
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
  const authRouter = createAuthRouter(service, createRequireAuth(service), environment);
  const app = createApp({ environment, authModule: { router: authRouter, service }, connectionRouter: null, databaseHealthCheck: async () => true });
  return { app, service, users, refreshTokens };
}

describe('authentication', () => {
  it('verifies the full new password and continues to accept existing bcrypt credentials', async () => {
    const hasher = createPasswordHasher();
    const prefix = 'a'.repeat(72);
    const hash = await hasher.hash(`${prefix}first`);
    expect(await hasher.compare(`${prefix}first`, hash)).toBe(true);
    expect(await hasher.compare(`${prefix}second`, hash)).toBe(false);
    expect(await hasher.compare('legacy-pass', await bcrypt.hash('legacy-pass', 4))).toBe(true);
  });

  it('approves new doctor profiles only when automatic approval is enabled', async () => {
    async function registerWithMode(autoApproveDoctors: boolean) {
      let profileInput: Record<string, unknown> | undefined;
      const user = {
        id: '00000000-0000-4000-8000-000000000006',
        email: `${autoApproveDoctors ? 'demo' : 'normal'}@example.com`,
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
            return { values: () => ({ onConflictDoNothing: () => ({ returning: async () => [user] }) }) };
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
      await createUsersService(fakeDatabase, { autoApproveDoctors })
        .register('doctor', user.email, user.passwordHash, async (_transaction, safeUser) => safeUser);
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
          return { values: () => ({ onConflictDoNothing: () => ({ returning: async () => [user] }) }) };
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

    await expect(service.register('doctor', user.email, user.passwordHash, async (_transaction, safeUser) => safeUser))
      .rejects.toThrow('profile write failed');
    expect(rolledBack).toBe(true);
  });

  it('rolls back the account and profile when writing the first refresh token fails', async () => {
    const user = {
      id: '00000000-0000-4000-8000-000000000007',
      email: 'session-rollback@example.com',
      passwordHash: 'test-only-stored-hash',
      role: 'doctor' as const,
      isActive: true,
      emailVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const expectedWrites = [users, doctorProfiles, authSessions, refreshTokenTable];
    const committed: unknown[] = [];
    const attempts: unknown[][] = [];
    const profile = { id: 'doctor-profile', fullName: 'Sample Clinician', verificationStatus: 'pending' };
    let rejectRefreshInsert = true;

    const database = {
      async transaction(callback: (executor: unknown) => Promise<unknown>) {
        const writes: unknown[] = [];
        attempts.push(writes);
        const transaction = {
          insert(table: unknown) {
            writes.push(table);
            if (table === users) return { values: () => ({ onConflictDoNothing: () => ({ returning: async () => [user] }) }) };
            if (table === doctorProfiles) return { values: () => ({ returning: async () => [profile] }) };
            if (table === authSessions) return { values: async () => undefined };
            if (table === refreshTokenTable) return { values: async () => {
              if (rejectRefreshInsert) throw new Error('refresh token write failed');
            } };
            throw new Error('unexpected table');
          },
        };
        const result = await callback(transaction);
        committed.push(...writes);
        return result;
      },
      select() {
        return { from: (table: unknown) => ({ where: () => ({ limit: async () => {
          if (!committed.includes(table)) return [];
          return table === users ? [user] : [profile];
        } }) }) };
      },
    } as unknown as Database;
    const service = createAuthService({
      environment,
      userService: createUsersService(database),
      userRepository: createUsersRepository(database),
      authRepository: createAuthRepository(database),
      passwordHasher: { hash: async () => user.passwordHash, compare: async () => false },
    });
    const input = { email: user.email, password: 'sunnyday' };

    await expect(service.registerDoctor(input)).rejects.toThrow('refresh token write failed');
    expect(attempts).toEqual([expectedWrites]);
    expect(committed).toEqual([]);

    rejectRefreshInsert = false;
    const registration = await service.registerDoctor(input);
    expect(attempts).toEqual([expectedWrites, expectedWrites]);
    expect(committed).toEqual(expectedWrites);
    expect(registration).toMatchObject({ email: user.email, accessToken: expect.any(String), refreshToken: expect.any(String) });
    expect(registration).not.toHaveProperty('passwordHash');
    const currentUser = await service.getCurrentUser(user.id);
    expect(currentUser).toMatchObject({ doctorProfile: { fullName: profile.fullName } });
    expect(currentUser).not.toHaveProperty('passwordHash');
  });

  it('treats only the email conflict as an existing account before writing a profile or session', async () => {
    const onConflictDoNothing = vi.fn(() => ({ returning: async () => [] }));
    const insert = vi.fn(() => ({ values: () => ({ onConflictDoNothing }) }));
    const complete = vi.fn();
    const database = {
      transaction: async (callback: (transaction: { insert: typeof insert }) => Promise<unknown>) => callback({ insert }),
    } as unknown as Database;

    await expect(createUsersService(database).register('patient', 'duplicate@example.com', 'stored-hash', complete))
      .rejects.toMatchObject({ statusCode: 409, code: 'EMAIL_ALREADY_REGISTERED' });
    expect(onConflictDoNothing).toHaveBeenCalledWith({ target: users.email });
    expect(insert).toHaveBeenCalledExactlyOnceWith(users);
    expect(complete).not.toHaveBeenCalled();
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
    const otherDevice = await harness.service.login(user.email, 'x');
    const rotated = await harness.service.refresh(initial.refreshToken);
    expect(rotated.refreshToken).not.toBe(initial.refreshToken);
    expect(rotated.sessionExpiresAt).toEqual(initial.sessionExpiresAt);
    await expect(harness.service.refresh(initial.refreshToken)).rejects.toMatchObject({ code: 'REFRESH_ALREADY_ROTATED' });
    harness.refreshTokens.get(initial.refreshToken.split('.')[0]!)!.revokedAt = new Date(Date.now() - 11_000);
    await expect(harness.service.refresh(initial.refreshToken)).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    await expect(harness.service.refresh(rotated.refreshToken)).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    await expect(harness.service.refresh(otherDevice.refreshToken)).resolves.toMatchObject({ accessToken: expect.any(String) });
  });

  it('starts a seven-day session at signup and caps subsequent refreshes at that date', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const start = new Date('2026-11-20T00:00:00Z');
    try {
      vi.setSystemTime(start);
      const { service } = createHarness();
      const tokens = await service.registerPatient({ email: 'new@example.com', password: 'sunnyday' });
      const cutoff = new Date('2026-11-27T00:00:00Z');
      expect(tokens.sessionExpiresAt).toEqual(cutoff);
      vi.setSystemTime(new Date(cutoff.getTime() - 60_000));
      const refreshed = await service.refresh(tokens.refreshToken);
      expect(refreshed.sessionExpiresAt).toEqual(cutoff);
      expect(refreshed.expiresIn).toBe(60);
      vi.setSystemTime(cutoff);
      await expect(service.refresh(refreshed.refreshToken)).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
      await expect(service.verifyAccessToken(refreshed.accessToken)).rejects.toMatchObject({ code: 'INVALID_ACCESS_TOKEN' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps web refresh tokens in a cookie and validates the dashboard origin', async () => {
    const api = request(createHarness().app);
    const web = { Origin: environment.FRONTEND_ORIGIN, 'X-GlycoTwin-Client': 'web' };
    const signup = await api.post('/api/v1/auth/register/doctor').set(web).send({ email: 'example@clinic.test', password: 'sunnyday' }).expect(201);
    expect(signup.body.data.refreshToken).toBeUndefined();
    expect(signup.body.data.accessToken).toEqual(expect.any(String));
    expect(signup.headers['cache-control']).toBe('no-store');
    const setCookie = signup.headers['set-cookie'][0];
    expect(setCookie).toMatch(/Path=\/backend\/auth;.*HttpOnly; SameSite=Strict/);
    const cookie = setCookie.split(';')[0];
    await api.post('/api/v1/auth/refresh').set({ ...web, Origin: 'https://other.example' }).set('Cookie', cookie).send({}).expect(403);
    await api.post('/api/v1/auth/refresh').set(web).set('Cookie', cookie).send({}).expect(200);
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
    const logout = await request(harness.app).post('/api/v1/auth/logout').send({ refreshToken: tokens.refreshToken });
    expect(logout.status).toBe(204);
    await expect(harness.service.refresh(tokens.refreshToken)).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  it('deletes only the authenticated account', async () => {
    const harness = createHarness();
    const user: UserRecord = {
      id: '00000000-0000-4000-8000-000000000005', email: 'delete@example.com', role: 'patient',
      isActive: true, emailVerifiedAt: null, createdAt: new Date(), updatedAt: new Date(), passwordHash: 'hashed:x',
    };
    const otherUser: UserRecord = { ...user, id: '00000000-0000-4000-8000-000000000006', email: 'keep@example.com' };
    harness.users.set(user.id, user);
    harness.users.set(otherUser.id, otherUser);
    const tokens = await harness.service.login(user.email, 'x');

    const response = await request(harness.app)
      .delete('/api/v1/auth/account')
      .set('authorization', `Bearer ${tokens.accessToken}`).send({ currentPassword: 'x' });

    expect(response.status).toBe(204);
    expect(harness.users.has(user.id)).toBe(false);
    expect(harness.users.has(otherUser.id)).toBe(true);
    expect((await request(harness.app).get('/api/v1/auth/me').set('authorization', `Bearer ${tokens.accessToken}`)).status).toBe(401);
  });

  it('confirms the current password and invalidates active sessions on a credential change', async () => {
    const harness = createHarness();
    const first = await harness.service.registerPatient({ email: 'change@example.com', password: 'sunnyday' });
    const second = await harness.service.login(first.email, 'sunnyday');
    const api = request(harness.app);
    const bearer = { Authorization: `Bearer ${first.accessToken}` };
    await api.delete('/api/v1/auth/account').set(bearer).send({ currentPassword: 'wrong' }).expect(403);
    await api.put('/api/v1/auth/account/password').set(bearer).send({ currentPassword: 'wrong', newPassword: 'new phrase' }).expect(403);
    await api.put('/api/v1/auth/account/password').set(bearer).send({ currentPassword: 'sunnyday', newPassword: 'new phrase' }).expect(204);
    await api.get('/api/v1/auth/me').set(bearer).expect(401);
    await expect(harness.service.refresh(second.refreshToken)).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    await expect(harness.service.login(first.email, 'new phrase')).resolves.toMatchObject({ accessToken: expect.any(String) });
  });
});
