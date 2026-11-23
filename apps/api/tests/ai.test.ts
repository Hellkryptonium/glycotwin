import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { AppError } from '../src/common/errors/app-error.js';
import type { Environment } from '../src/config/env.js';
import { createRequireActiveAuth, createRequireAuth, createRequireRole, createRequireVerifiedDoctor } from '../src/middleware/auth.middleware.js';
import type { AuthenticatedUser, AccessTokenClaims } from '../src/modules/auth/auth.types.js';
import { createAiRouter } from '../src/modules/ai/ai.routes.js';
import type { AiConversationControllerService } from '../src/modules/ai/ai.controller.js';
import { createAiService, type AiGeminiClient } from '../src/modules/ai/ai.service.js';
import type { GetPatientProfileTool, PatientProfileForAgent } from '../src/modules/ai/patient-profile.tool.js';

const environment: Environment = {
  NODE_ENV: 'test',
  DEMO_MODE: false,
  AUTO_APPROVE_DOCTOR_SIGNUPS: false,
  AI_ENABLED: true,
  GEMINI_API_KEY: 'test-key',
  GEMINI_MODEL: 'test-model',
  PORT: 5000,
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_ISSUER: 'glycotwin-api',
  JWT_AUDIENCE: 'glycotwin-clients',
  BCRYPT_ROUNDS: 10,
  FRONTEND_ORIGIN: 'http://localhost:3000',
};

const doctorUserId = '00000000-0000-4000-8000-000000000001';
const patientUserId = '00000000-0000-4000-8000-000000000002';
const patientProfileId = '00000000-0000-4000-8000-000000000013';

function user(
  id: string,
  role: 'doctor' | 'patient',
  verificationStatus: 'pending' | 'verified' = 'verified',
  isActive = true,
): AuthenticatedUser {
  return {
    id,
    email: `${id.slice(-2)}@example.com`,
    role,
    isActive,
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...(role === 'doctor' ? {
      doctorProfile: {
        id: '00000000-0000-4000-8000-000000000011',
        fullName: 'Doctor',
        medicalRegistrationNumber: null,
        medicalCouncil: null,
        specialization: null,
        hospitalOrClinic: null,
        yearsOfExperience: null,
        verificationStatus,
      },
    } : {}),
  };
}

function createRouter(options: {
  role?: 'doctor' | 'patient';
  verificationStatus?: 'pending' | 'verified';
  active?: boolean;
  chat?: (doctorUserId: string, patientProfileId: string, message: string) => Promise<string>;
  conversationService?: AiConversationControllerService;
} = {}) {
  const role = options.role ?? 'doctor';
  const verificationStatus = options.verificationStatus ?? 'verified';
  const active = options.active ?? true;
  const currentUser = user(
    role === 'doctor' ? doctorUserId : patientUserId,
    role,
    verificationStatus,
    active,
  );
  const verifier = {
    verifyAccessToken: vi.fn(async (token: string): Promise<AccessTokenClaims> => {
      if (token !== 'valid-token') throw new Error('invalid token');
      return {
        sub: currentUser.id,
        role,
        iat: 1,
        exp: 9999999999,
        jti: 'test-session',
        sid: 'test-session',
      };
    }),
    getCurrentUser: vi.fn(async (userId: string) => {
      if (userId !== currentUser.id) throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
      if (!currentUser.isActive) throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
      return currentUser;
    }),
  };

  const service = {
    chat: options.chat ?? vi.fn(async () => 'AI reply'),
  };
  const router = createAiRouter(
    service,
    createRequireAuth(verifier),
    createRequireActiveAuth(verifier),
    (requiredRole) => createRequireRole(requiredRole),
    createRequireVerifiedDoctor(verifier),
    options.conversationService,
  );
  return { router, verifier, service };
}

function createTestApp(aiRouter: Router) {
  return createApp({
    environment,
    databaseHealthCheck: async () => true,
    authModule: null,
    aiRouter,
  });
}

describe('POST /api/ai/chat', () => {
  it('keeps persisted conversations behind the same verified-doctor gate', async () => {
    const conversations: AiConversationControllerService = {
      list: vi.fn(async () => [{ id: '00000000-0000-4000-8000-000000000099' }]),
      create: vi.fn(), get: vi.fn(), send: vi.fn(),
    };
    const { router } = createRouter({ conversationService: conversations });
    const response = await request(createTestApp(router))
      .get('/api/ai/conversations')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([{ id: '00000000-0000-4000-8000-000000000099' }]);
    expect(conversations.list).toHaveBeenCalledWith(doctorUserId);
  });

  it('rejects unauthenticated requests', async () => {
    const { router } = createRouter();
    const response = await request(createTestApp(router))
      .post('/api/ai/chat')
      .send({ patientProfileId, message: 'Hello' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects non-doctor requests', async () => {
    const { router } = createRouter({ role: 'patient' });
    const response = await request(createTestApp(router))
      .post('/api/ai/chat')
      .set('Authorization', 'Bearer valid-token')
      .send({ patientProfileId, message: 'Hello' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects unverified doctors', async () => {
    const { router } = createRouter({ verificationStatus: 'pending' });
    const response = await request(createTestApp(router))
      .post('/api/ai/chat')
      .set('Authorization', 'Bearer valid-token')
      .send({ patientProfileId, message: 'Hello' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('DOCTOR_VERIFICATION_REQUIRED');
  });

  it('rejects invalid body fields and missing patient IDs', async () => {
    const { router } = createRouter();
    const missing = await request(createTestApp(router))
      .post('/api/ai/chat')
      .set('Authorization', 'Bearer valid-token')
      .send({ message: 'Hello' });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('VALIDATION_ERROR');

    const extra = await request(createTestApp(router))
      .post('/api/ai/chat')
      .set('Authorization', 'Bearer valid-token')
      .send({ patientProfileId, message: 'Hello', doctorUserId });
    expect(extra.status).toBe(400);
    expect(extra.body.error.code).toBe('VALIDATION_ERROR');

    const invalidMessage = await request(createTestApp(router))
      .post('/api/ai/chat')
      .set('Authorization', 'Bearer valid-token')
      .send({ patientProfileId, message: '   ' });
    expect(invalidMessage.status).toBe(400);
  });

  it('allows an authorized doctor and returns a successful JSON reply', async () => {
    const profile: PatientProfileForAgent = {
      id: patientProfileId,
      fullName: 'Asha Patient',
      dateOfBirth: new Date('1990-05-10T00:00:00.000Z'),
      gender: 'female',
      diabetesType: 'type 2',
    };
    const tool: GetPatientProfileTool = {
      getPatientProfile: vi.fn(async () => profile),
    };
    const gemini: AiGeminiClient = {
      generateContent: vi.fn().mockResolvedValue({
        candidates: [{
          content: {
            role: 'model',
            parts: [{ text: 'Approved AI reply.' }],
          },
        }],
      } as never),
    };
    const aiService = createAiService(gemini, tool, 'test-model');
    const { router } = createRouter({
      chat: (trustedDoctorId, selectedPatientId, message) =>
        aiService.chat(trustedDoctorId, selectedPatientId, message),
    });

    const response = await request(createTestApp(router))
      .post('/api/ai/chat')
      .set('Authorization', 'Bearer valid-token')
      .send({ patientProfileId, message: 'Summarize the selected patient' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { reply: 'Approved AI reply.' },
    });
    expect(tool.getPatientProfile).toHaveBeenCalledWith(doctorUserId, patientProfileId);
  });

  it('rejects an unauthorized patient with a safe API error', async () => {
    const chat = vi.fn(async () => {
      throw new AppError(403, 'PATIENT_RELATIONSHIP_REQUIRED', 'An active patient relationship is required.');
    });
    const { router } = createRouter({ chat });
    const response = await request(createTestApp(router))
      .post('/api/ai/chat')
      .set('Authorization', 'Bearer valid-token')
      .send({ patientProfileId, message: 'Get profile' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('PATIENT_RELATIONSHIP_REQUIRED');
    expect(response.body).not.toHaveProperty('stack');
  });

  it('rejects inactive doctors', async () => {
    const { router } = createRouter({ active: false });
    const response = await request(createTestApp(router))
      .post('/api/ai/chat')
      .set('Authorization', 'Bearer valid-token')
      .send({ patientProfileId, message: 'Hello' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
