import type { Database } from '../../config/database.js';
import type { Environment } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  createRequireActiveAuth,
  createRequireAuth,
  createRequireRole,
  createRequireVerifiedDoctor,
} from '../../middleware/auth.middleware.js';
import type { AuthService } from '../auth/auth.types.js';
import { createDoctorsRepository } from '../doctors/doctors.repository.js';
import { createPatientsRepository } from '../patients/patients.repository.js';
import { createAiService, type AiGeminiClient } from './ai.service.js';
import { createAiConversationRepository } from './ai-conversations.repository.js';
import { createAiConversationService } from './ai-conversations.service.js';
import { createGeminiClient } from './gemini.client.js';
import { createGetPatientProfileTool } from './patient-profile.tool.js';
import { createPatientClinicalSummaryTool } from './patient-clinical-summary.tool.js';
import { AiLiveGateway } from './ai-live.gateway.js';
import { createAiRouter } from './ai.routes.js';
import { createPatientAiService } from './patient-ai.service.js';
import { createPatientAiRouter } from './patient-ai.routes.js';

export function createAiModule(
  database: Database,
  authService: AuthService,
  environment: Environment,
  geminiOverride?: AiGeminiClient,
) {
  const geminiClient = geminiOverride ?? createGeminiClient(environment);
  const patientRepository = createPatientsRepository(database);
  const doctorRepository = createDoctorsRepository(database);
  const patientProfileTool = createGetPatientProfileTool(
    patientRepository,
    doctorRepository,
    authService.getCurrentUser,
  );
  const clinicalSummaryTool = createPatientClinicalSummaryTool(database, patientProfileTool);
  const aiService = geminiClient
    ? createAiService(geminiClient, patientProfileTool, environment.GEMINI_MODEL, clinicalSummaryTool)
    : {
        chat: async () => {
          throw new AppError(503, 'AI_DISABLED', 'The AI provider is disabled.');
        },
        reply: async () => {
          throw new AppError(503, 'AI_DISABLED', 'The AI provider is disabled.');
        },
      };

  const conversationRepository = createAiConversationRepository(database);
  const conversationService = createAiConversationService(
    conversationRepository,
    aiService,
    patientProfileTool,
  );
  const liveGateway = new AiLiveGateway(environment, conversationService, clinicalSummaryTool);
  const patientAiService = createPatientAiService(database, geminiClient, environment.GEMINI_MODEL);
  const requireAuth = createRequireAuth(authService);
  const requireActiveAuth = createRequireActiveAuth(authService);
  const requireRole = (role: 'doctor' | 'patient') => createRequireRole(role);

  return {
    service: aiService,
    liveGateway,
    router: createAiRouter(
      aiService,
      requireAuth,
      requireActiveAuth,
      requireRole,
      createRequireVerifiedDoctor(authService),
      conversationService,
      liveGateway,
    ),
    patientRouter: createPatientAiRouter(patientAiService, requireAuth, requireActiveAuth, requireRole('patient')),
  };
}
