import type { RequestHandler } from 'express';
import type { HealthService } from './health.service.js';

export function createLivenessController(service: HealthService): RequestHandler {
  return (_request, response) => {
    response.json({ success: true, data: service.checkLiveness() });
  };
}

export function createReadinessController(service: HealthService): RequestHandler {
  return async (_request, response, next) => {
    try {
      const isReady = await service.checkReadiness();

      if (!isReady) {
        response.status(503).json({
          success: false,
          error: {
            code: 'DATABASE_UNAVAILABLE',
            message: 'Database is unavailable.',
          },
          requestId: response.locals.requestId,
        });
        return;
      }

      response.json({
        success: true,
        data: { status: 'ready', database: 'connected' },
      });
    } catch (error) {
      next(error);
    }
  };
}