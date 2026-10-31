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
import { createGlucoseModule } from './modules/health-records/glucose.module.js';
import { createRoutes } from './routes/index.js';

export interface AppOptions {
  environment?: Environment;
  databaseHealthCheck?: DatabaseHealthCheck;
  additionalRoutes?: Router;
  authModule?: AuthModule | null;
  connectionRouter?: Router | null;
  patientProfileRouter?: Router | null;
  glucoseRouter?: Router | null;
}

export function createApp(options: AppOptions = {}) {
  const environment = options.environment ?? loadEnvironment();
  const databaseHealthCheck = options.databaseHealthCheck ?? checkDatabaseConnection;
  const authModule = options.authModule === null
    ? undefined
    : options.authModule ?? createAuthModule(getDatabase(), environment);
  const connectionRouter = options.connectionRouter === null
    ? undefined
    : options.connectionRouter ?? (authModule ? createConnectionModule(getDatabase(), authModule.service).router : undefined);
  const patientProfileRouter = options.patientProfileRouter === null
    ? undefined
    : options.patientProfileRouter ?? (authModule ? createPatientProfileModule(getDatabase(), authModule.service).router : undefined);
  const glucoseRouter = options.glucoseRouter === null
    ? undefined
    : options.glucoseRouter ?? (authModule ? createGlucoseModule(getDatabase(), authModule.service).router : undefined);
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: environment.FRONTEND_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(pinoHttp({ redact: ['req.headers.authorization', 'req.headers.cookie'] }));
  app.use(requestIdMiddleware);
  app.use(rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use(createRoutes(createHealthService(databaseHealthCheck), authModule?.router, connectionRouter, patientProfileRouter, glucoseRouter));

  if (options.additionalRoutes) {
    app.use(options.additionalRoutes);
  }

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}