import rateLimit from 'express-rate-limit';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { patientAiMessageInputSchema } from './patient-ai.service.js';

type PatientAiService = {
  list(patientUserId: string): Promise<unknown>;
  create(patientUserId: string): Promise<unknown>;
  get(patientUserId: string, conversationId: string): Promise<unknown>;
  send(patientUserId: string, conversationId: string, input: unknown, diagnosticContext?: { requestId?: string; logger?: { error(fields: Record<string, unknown>, message: string): void } }): Promise<unknown>;
};

export function createPatientAiRouter(service: PatientAiService, requireAuth: RequestHandler, requireActiveAuth: RequestHandler, requirePatient: RequestHandler) {
  const router = Router();
  const limiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
  router.use(requireAuth, requireActiveAuth, requirePatient);
  router.get('/conversations', async (_request, response, next) => {
    try { response.json({ success: true, data: await service.list(response.locals.authenticatedUser!.sub) }); } catch (error) { next(error); }
  });
  router.post('/conversations', limiter, async (_request, response, next) => {
    try { response.status(201).json({ success: true, data: await service.create(response.locals.authenticatedUser!.sub) }); } catch (error) { next(error); }
  });
  router.get('/conversations/:id', async (request, response, next) => {
    try { response.json({ success: true, data: await service.get(response.locals.authenticatedUser!.sub, z.string().uuid().parse(request.params.id)) }); } catch (error) { next(error); }
  });
  router.post('/conversations/:id/messages', limiter, async (request, response, next) => {
    try {
      const id = z.string().uuid().parse(request.params.id);
      const input = patientAiMessageInputSchema.parse(request.body);
      response.status(201).json({ success: true, data: await service.send(response.locals.authenticatedUser!.sub, id, input, { requestId: response.locals.requestId, logger: request.log }) });
    } catch (error) { next(error); }
  });
  return router;
}
