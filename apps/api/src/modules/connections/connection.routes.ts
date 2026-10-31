import { Router } from 'express';
import type { RequestHandler } from 'express';
import { createConnectionController, type ConnectionControllerService } from './connection.controller.js';

export function createConnectionRouter(
  service: ConnectionControllerService,
  requireAuth: RequestHandler,
  requireActiveAuth: RequestHandler,
  requireRole: (role: 'doctor' | 'patient') => RequestHandler,
  requireVerifiedDoctor: RequestHandler,
): Router {
  const router = Router();
  const controller = createConnectionController(service);
  const doctorGuard = [requireAuth, requireVerifiedDoctor];
  const patientGuard = [requireAuth, requireActiveAuth, requireRole('patient')];

  router.get('/doctor/patients/search', ...doctorGuard, controller.searchPatients);
  router.post('/doctor/invitations', ...doctorGuard, controller.createInvitation);
  router.get('/doctor/patients', ...doctorGuard, controller.listConnectedPatients);
  router.get('/patient/invitations', ...patientGuard, controller.listInvitations);
  router.post('/patient/invitations/:id/respond', ...patientGuard, controller.respondToInvitation);
  router.post('/patient/relationships/:id/revoke', ...patientGuard, controller.revokeRelationship);
  return router;
}