import rateLimit from 'express-rate-limit';
import { Router } from 'express';
import type { RequestHandler } from 'express';
import { createAiController, createAiConversationController, type AiControllerService, type AiConversationControllerService } from './ai.controller.js';

export function createAiRouter(
  service: AiControllerService,
  requireAuth: RequestHandler,
  requireActiveAuth: RequestHandler,
  requireRole: (role: 'doctor' | 'patient') => RequestHandler,
  requireVerifiedDoctor: RequestHandler,
  conversationService?: AiConversationControllerService,
  liveGateway?: { createTicket(doctorUserId: string): { ticket: string; expiresAt: Date } },
): Router {
  const router = Router();
  const controller = createAiController(service);
  const chatLimiter = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });

  router.post(
    '/chat',
    chatLimiter,
    requireAuth,
    requireActiveAuth,
    requireRole('doctor'),
    requireVerifiedDoctor,
    controller.chat,
  );
  if (conversationService) {
    const conversations = createAiConversationController(conversationService);
    router.get('/conversations', requireAuth, requireActiveAuth, requireRole('doctor'), requireVerifiedDoctor, conversations.list);
    router.post('/conversations', chatLimiter, requireAuth, requireActiveAuth, requireRole('doctor'), requireVerifiedDoctor, conversations.create);
    router.get('/conversations/:id', requireAuth, requireActiveAuth, requireRole('doctor'), requireVerifiedDoctor, conversations.get);
    router.post('/conversations/:id/messages', chatLimiter, requireAuth, requireActiveAuth, requireRole('doctor'), requireVerifiedDoctor, conversations.send);
  }
  if (liveGateway) {
    router.post('/live/tickets', chatLimiter, requireAuth, requireActiveAuth, requireRole('doctor'), requireVerifiedDoctor, (request, response, next) => {
      try { response.status(201).json({ success: true, data: liveGateway.createTicket(response.locals.authenticatedUser!.sub) }); } catch (error) { next(error); }
    });
  }
  return router;
}
