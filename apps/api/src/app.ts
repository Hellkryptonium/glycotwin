import cors from 'cors';
import express, { type Router } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { checkDatabaseConnection, getDatabase } from './config/database.js';
import { loadEnvironment, type Environment } from './config/env.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { notFoundMiddleware } from './middleware/not-found.middleware.js';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { createHealthService, type DatabaseHealthCheck } from './modules/health/health.service.js';
import { createAuthModule, type AuthModule } from './modules/auth/auth.routes.js';
import { createConnectionModule } from './modules/connections/connection.module.js';
import { createPatientProfileModule } from './modules/patients/profile.module.js';
import { createCareRouter } from './modules/patients/care.routes.js';
import { createDoctorProfileRouter } from './modules/doctors/doctor-profile.routes.js';
import { createGlucoseModule } from './modules/health-records/glucose.module.js';
import { createLifestyleModule } from './modules/lifestyle/lifestyle.module.js';
import { createMedicationModule } from './modules/medications/medication.module.js';
import { createAiModule } from './modules/ai/ai.module.js';
import { createMediaModule } from './modules/media/media.module.js';
import { createRoutes } from './routes/index.js';

export interface AppOptions {
  environment?: Environment;
  databaseHealthCheck?: DatabaseHealthCheck;
  additionalRoutes?: Router;
  authModule?: AuthModule | null;
  connectionRouter?: Router | null;
  patientProfileRouter?: Router | null;
  glucoseRouter?: Router | null;
  analyticsRouter?: Router | null;
  aiRouter?: Router | null;
  patientAiRouter?: Router | null;
  mediaRouter?: Router | null;
}

export function createApp(options: AppOptions = {}) {
  const environment = options.environment ?? loadEnvironment();
  const databaseHealthCheck = options.databaseHealthCheck ?? checkDatabaseConnection;
  const autoApproveDoctors = environment.DEMO_MODE || environment.AUTO_APPROVE_DOCTOR_SIGNUPS;
  const authModule = options.authModule === null
    ? undefined
    : options.authModule ?? createAuthModule(getDatabase(), environment, autoApproveDoctors);
  const connectionRouter = options.connectionRouter === null
    ? undefined
    : options.connectionRouter ?? (authModule ? createConnectionModule(getDatabase(), authModule.service).router : undefined);
  const mediaModule = authModule ? createMediaModule(getDatabase(), authModule.service, environment) : undefined;
  const patientProfileRouter = options.patientProfileRouter === null
    ? undefined
    : options.patientProfileRouter ?? (authModule ? createPatientProfileModule(getDatabase(), authModule.service).router
      .use(createDoctorProfileRouter(getDatabase(), authModule.service, autoApproveDoctors))
      .use(createCareRouter(getDatabase(), authModule.service)) : undefined);
  const glucoseModule = authModule ? createGlucoseModule(getDatabase(), authModule.service, environment) : undefined;
  const glucoseRouter = options.glucoseRouter === null
    ? undefined
    : options.glucoseRouter ?? glucoseModule?.router;
  const analyticsRouter = options.analyticsRouter === null
    ? undefined
    : options.analyticsRouter ?? glucoseModule?.analyticsRouter;
  const lifestyleRouter = authModule ? createLifestyleModule(getDatabase(), authModule.service).router : undefined;
  const medicationRouter = authModule ? createMedicationModule(getDatabase(), authModule.service).router : undefined;
  const aiModule = options.aiRouter === undefined && authModule
    ? createAiModule(getDatabase(), authModule.service, environment)
    : undefined;
  const aiRouter = options.aiRouter === null
    ? undefined
    : options.aiRouter ?? aiModule?.router;
  const patientAiRouter = options.patientAiRouter === null
    ? undefined
    : options.patientAiRouter ?? aiModule?.patientRouter;
  const mediaRouter = options.mediaRouter === null ? undefined : options.mediaRouter ?? mediaModule?.router;
  const app = express();
  app.locals.aiLiveGateway = aiModule?.liveGateway;

  app.use(helmet());
  app.use(cors({ origin: environment.FRONTEND_ORIGIN }));
  // Patient photo review accepts a compressed image as base64 and enforces a
  // tighter per-image limit in the AI service. Keep all other JSON payloads
  // bounded without requiring a client-side Gemini key.
  app.use(express.json({ limit: '8mb' }));
  app.use(express.urlencoded({ extended: true, limit: '8mb' }));
  app.use(pinoHttp({ redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers.referer', 'res.headers["set-cookie"]'] }));
  app.use(requestIdMiddleware);
  app.use(rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use(createRoutes(createHealthService(databaseHealthCheck), authModule?.router, connectionRouter, patientProfileRouter, glucoseRouter, analyticsRouter, lifestyleRouter, medicationRouter, aiRouter, patientAiRouter, mediaRouter));

  if (options.additionalRoutes) {
    app.use(options.additionalRoutes);
  }

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
