import type { Database } from '../../config/database.js';
import { createRequireActiveAuth, createRequireAuth, createRequireRole, createRequireVerifiedDoctor } from '../../middleware/auth.middleware.js';
import type { AuthService } from '../auth/auth.types.js';
import { createLifestyleController } from './lifestyle.controller.js';
import { createLifestyleRepository } from './lifestyle.repository.js';
import { createLifestyleService } from './lifestyle.service.js';
import { Router } from 'express';
export function createLifestyleModule(database: Database, authService: AuthService) {
  const repository = createLifestyleRepository(database);
  const service = createLifestyleService(repository, authService.getCurrentUser);
  const controller = createLifestyleController(service);
  const router = Router();
  const patient = [createRequireAuth(authService), createRequireActiveAuth(authService), createRequireRole('patient')];
  const doctor = [createRequireAuth(authService), createRequireVerifiedDoctor(authService)];
  for (const type of ['meals', 'activities', 'sleep', 'symptoms'] as const) {
    router.post(`/patient/lifestyle/${type}`, ...patient, controller.create);
    const singularType = type === 'meals' ? 'meal' : type === 'activities' ? 'activity' : type === 'symptoms' ? 'symptom' : 'sleep';
    router.get(`/patient/lifestyle/${type}`, ...patient, controller.listOwnForType(singularType));
  }
  router.get('/patient/lifestyle/timeline', ...patient, controller.listOwn);
  router.get('/patient/lifestyle/:id', ...patient, controller.get);
  router.patch('/patient/lifestyle/:id', ...patient, controller.update);
  router.delete('/patient/lifestyle/:id', ...patient, controller.remove);
  router.get('/doctor/patients/:patientId/lifestyle/timeline', ...doctor, controller.listDoctor);
  return { service, router };
}
