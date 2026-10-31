import { Router } from 'express';
import { createHealthRouter } from '../modules/health/health.routes.js';
import type { HealthService } from '../modules/health/health.service.js';

export function createRoutes(healthService: HealthService, authRouter?: Router, connectionRouter?: Router, patientProfileRouter?: Router, glucoseRouter?: Router): Router {
  const router = Router();
  const healthRouter = createHealthRouter(healthService);

  router.use(healthRouter);
  router.use('/api/v1', healthRouter);
  if (authRouter) {
    router.use('/api/v1/auth', authRouter);
  }
  if (connectionRouter) {
    router.use('/api/v1', connectionRouter);
  }
  if (patientProfileRouter) {
    router.use('/api/v1', patientProfileRouter);
  }
  if (glucoseRouter) {
    router.use('/api/v1', glucoseRouter);
  }

  return router;
}