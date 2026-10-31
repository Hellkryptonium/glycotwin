import { Router } from 'express';
import { createLivenessController, createReadinessController } from './health.controller.js';
import type { HealthService } from './health.service.js';

export function createHealthRouter(service: HealthService): Router {
  const router = Router();
  router.get('/health', createLivenessController(service));
  router.get('/health/ready', createReadinessController(service));
  return router;
}