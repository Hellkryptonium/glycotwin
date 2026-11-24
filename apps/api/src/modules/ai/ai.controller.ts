import type { RequestHandler } from 'express';
import { z } from 'zod';
import { aiChatSchema, aiConversationMessageSchema, aiConversationSchema } from './ai.schema.js';
import type { AiConversationMode } from './ai-conversations.repository.js';

export interface AiControllerService {
  chat(
    authenticatedDoctorUserId: string,
    selectedPatientProfileId: string,
    userMessage: string,
    diagnosticContext?: {
      requestId?: string;
      logger?: {
        error(fields: Record<string, unknown>, message: string): void;
      };
    },
  ): Promise<string>;
}

export interface AiConversationControllerService {
  list(doctorUserId: string): Promise<unknown>;
  create(doctorUserId: string, mode: AiConversationMode, patientProfileId?: string | null): Promise<unknown>;
  get(doctorUserId: string, conversationId: string): Promise<unknown>;
  send(doctorUserId: string, conversationId: string, message: string, diagnosticContext?: {
    requestId?: string;
    logger?: { error(fields: Record<string, unknown>, message: string): void };
  }): Promise<unknown>;
}

export function createAiController(service: AiControllerService) {
  const chat: RequestHandler = async (request, response, next) => {
    try {
      const input = aiChatSchema.parse(request.body);
      const reply = await service.chat(
        response.locals.authenticatedUser!.sub,
        input.patientProfileId,
        input.message,
        {
          requestId: response.locals.requestId,
          logger: request.log,
        },
      );
      response.json({ success: true, data: { reply } });
    } catch (error) {
      next(error);
    }
  };

  return { chat };
}

export function createAiConversationController(service: AiConversationControllerService) {
  const list: RequestHandler = async (_request, response, next) => {
    try {
      response.json({ success: true, data: await service.list(response.locals.authenticatedUser!.sub) });
    } catch (error) { next(error); }
  };
  const create: RequestHandler = async (request, response, next) => {
    try {
      const input = aiConversationSchema.parse(request.body);
      const conversation = await service.create(response.locals.authenticatedUser!.sub, input.mode, input.patientProfileId);
      response.status(201).json({ success: true, data: conversation });
    } catch (error) { next(error); }
  };
  const get: RequestHandler = async (request, response, next) => {
    try {
      const id = z.string().uuid().parse(request.params.id);
      response.json({ success: true, data: await service.get(response.locals.authenticatedUser!.sub, id) });
    } catch (error) { next(error); }
  };
  const send: RequestHandler = async (request, response, next) => {
    try {
      const input = aiConversationMessageSchema.parse(request.body);
      const id = z.string().uuid().parse(request.params.id);
      const result = await service.send(response.locals.authenticatedUser!.sub, id, input.message, {
        requestId: response.locals.requestId,
        logger: request.log,
      });
      response.status(201).json({ success: true, data: result });
    } catch (error) { next(error); }
  };
  return { list, create, get, send };
}
