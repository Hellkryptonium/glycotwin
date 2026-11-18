import { Router } from 'express';
import type { RequestHandler } from 'express';
import { createAnalyticsController } from './analytics.controller.js';

export function createAnalyticsRouter(
  service: Parameters<typeof createAnalyticsController>[0],
  requireAuth: RequestHandler,
  requireActiveAuth: RequestHandler,
  requireRole: (role: 'doctor' | 'patient') => RequestHandler,
  requireVerifiedDoctor: RequestHandler,
) {
  const router = Router();
  const controller = createAnalyticsController(service);
  router.get('/patient/analytics/glucose', requireAuth, requireActiveAuth, requireRole('patient'), controller.own);
  router.get('/doctor/patients/:patientId/analytics/glucose', requireAuth, requireVerifiedDoctor, controller.forDoctor);
  return router;
}
