import { Router } from 'express';
import type { RequestHandler } from 'express';
import { createPatientProfileController } from './profile.controller.js';

export function createPatientProfileRouter(
  service: Parameters<typeof createPatientProfileController>[0],
  requireAuth: RequestHandler,
  requireActiveAuth: RequestHandler,
  requireRole: (role: 'doctor' | 'patient') => RequestHandler,
  requireVerifiedDoctor: RequestHandler,
) {
  const router = Router();
  const controller = createPatientProfileController(service);
  router.get('/patient/profile', requireAuth, requireActiveAuth, requireRole('patient'), controller.getOwnProfile);
  router.put('/patient/profile', requireAuth, requireActiveAuth, requireRole('patient'), controller.updateOwnProfile);
  router.get('/doctor/patients/:patientId/profile', requireAuth, requireVerifiedDoctor, controller.getForDoctor);
  return router;
}
