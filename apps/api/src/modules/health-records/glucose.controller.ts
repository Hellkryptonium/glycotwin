import type { RequestHandler } from 'express';
import { glucoseIdSchema, glucoseListSchema, glucoseReadingInputSchema } from './glucose.schema.js';

export function createGlucoseController(service: {
  create(userId: string, input: unknown): Promise<unknown>;
  listOwn(userId: string, input: unknown): Promise<unknown>;
  getOwn(userId: string, id: string): Promise<unknown>;
  update(userId: string, id: string, input: unknown): Promise<unknown>;
  remove(userId: string, id: string): Promise<void>;
  listForDoctor(userId: string, patientId: string, input: unknown): Promise<unknown>;
}) {
  const create: RequestHandler = async (request, response, next) => {
    try { response.status(201).json({ success: true, data: await service.create(response.locals.authenticatedUser!.sub, glucoseReadingInputSchema.parse(request.body)) }); } catch (error) { next(error); }
  };
  const listOwn: RequestHandler = async (request, response, next) => {
    try { response.json({ success: true, data: await service.listOwn(response.locals.authenticatedUser!.sub, glucoseListSchema.parse(request.query)) }); } catch (error) { next(error); }
  };
  const getOwn: RequestHandler = async (request, response, next) => {
    try { const { id } = glucoseIdSchema.parse(request.params); response.json({ success: true, data: await service.getOwn(response.locals.authenticatedUser!.sub, id) }); } catch (error) { next(error); }
  };
  const update: RequestHandler = async (request, response, next) => {
    try { const { id } = glucoseIdSchema.parse(request.params); response.json({ success: true, data: await service.update(response.locals.authenticatedUser!.sub, id, glucoseReadingInputSchema.parse(request.body)) }); } catch (error) { next(error); }
  };
  const remove: RequestHandler = async (request, response, next) => {
    try { const { id } = glucoseIdSchema.parse(request.params); await service.remove(response.locals.authenticatedUser!.sub, id); response.status(204).send(); } catch (error) { next(error); }
  };
  const listForDoctor: RequestHandler = async (request, response, next) => {
    try {
      const patientId = glucoseIdSchema.shape.id.parse(request.params.patientId);
      response.json({ success: true, data: await service.listForDoctor(response.locals.authenticatedUser!.sub, patientId, glucoseListSchema.parse(request.query)) });
    } catch (error) { next(error); }
  };
  return { create, listOwn, getOwn, update, remove, listForDoctor };
}
