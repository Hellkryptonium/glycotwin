import type { RequestHandler } from 'express';
import { z } from 'zod';
import { analyticsSchema } from './analytics.schema.js';

const patientIdSchema = z.string().uuid('Patient ID must be a valid UUID');

export function createAnalyticsController(service: {
  own(userId: string, input: unknown): Promise<unknown>;
  forDoctor(userId: string, patientId: string, input: unknown): Promise<unknown>;
}) {
  const own: RequestHandler = async (request, response, next) => {
    try { response.json({ success: true, data: await service.own(response.locals.authenticatedUser!.sub, analyticsSchema.parse(request.query)) }); } catch (error) { next(error); }
  };
  const forDoctor: RequestHandler = async (request, response, next) => {
    try {
      const patientId = patientIdSchema.parse(request.params.patientId);
      response.json({ success: true, data: await service.forDoctor(response.locals.authenticatedUser!.sub, patientId, analyticsSchema.parse(request.query)) });
    } catch (error) { next(error); }
  };
  return { own, forDoctor };
}
