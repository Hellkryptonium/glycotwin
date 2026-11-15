import { Router } from 'express';
import type { Database } from '../../config/database.js';
import { createRequireActiveAuth, createRequireAuth, createRequireRole, createRequireVerifiedDoctor } from '../../middleware/auth.middleware.js';
import type { AuthService } from '../auth/auth.types.js';
import { createMedicationController } from './medication.controller.js';
import { createMedicationRepository } from './medication.repository.js';
import { createMedicationService } from './medication.service.js';

export function createMedicationModule(database: Database, authService: AuthService) {
  const service = createMedicationService(createMedicationRepository(database), authService.getCurrentUser);
  const controller = createMedicationController(service);
  const router = Router();
  const patient = [createRequireAuth(authService), createRequireActiveAuth(authService), createRequireRole('patient')];
  const doctor = [createRequireAuth(authService), createRequireVerifiedDoctor(authService)];
  router.post('/patient/medications', ...patient, controller.create);
  router.get('/patient/medications', ...patient, controller.listOwn);
  router.get('/patient/medications/:id', ...patient, controller.getOwn);
  router.patch('/patient/medications/:id', ...patient, controller.update);
  router.delete('/patient/medications/:id', ...patient, controller.remove);
  router.post('/patient/medications/:id/discontinue', ...patient, controller.discontinue);
  router.get('/patient/medications/:id/doses', ...patient, controller.listDoses);
  router.post('/patient/medications/:id/doses', ...patient, controller.createDose);
  router.patch('/patient/medications/:id/doses/:doseId', ...patient, controller.updateDose);
  router.get('/doctor/patients/:patientId/medications', ...doctor, controller.doctorList);
  router.get('/doctor/patients/:patientId/medications/:medicationId/doses', ...doctor, controller.doctorDoses);
  return { router, service };
}
