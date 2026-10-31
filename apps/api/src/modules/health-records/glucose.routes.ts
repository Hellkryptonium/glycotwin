import { Router } from 'express';
import type { RequestHandler } from 'express';
import { createGlucoseController } from './glucose.controller.js';

export function createGlucoseRouter(
  service: Parameters<typeof createGlucoseController>[0],
  requireAuth: RequestHandler,
  requireActiveAuth: RequestHandler,
  requireRole: (role: 'doctor' | 'patient') => RequestHandler,
  requireVerifiedDoctor: RequestHandler,
) {
  const router = Router();
  const controller = createGlucoseController(service);
  const patient = [requireAuth, requireActiveAuth, requireRole('patient')];
  const doctor = [requireAuth, requireVerifiedDoctor];
  router.post('/patient/glucose-readings', ...patient, controller.create);
  router.get('/patient/glucose-readings', ...patient, controller.listOwn);
  router.get('/patient/glucose-readings/:id', ...patient, controller.getOwn);
  router.put('/patient/glucose-readings/:id', ...patient, controller.update);
  router.delete('/patient/glucose-readings/:id', ...patient, controller.remove);
  router.get('/doctor/patients/:patientId/glucose-readings', ...doctor, controller.listForDoctor);
  return router;
}
