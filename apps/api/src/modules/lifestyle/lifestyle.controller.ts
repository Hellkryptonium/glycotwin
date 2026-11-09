import type { RequestHandler } from 'express';
import { lifestyleIdSchema, lifestyleInputSchema, lifestyleListSchema } from './lifestyle.schema.js';
import type { LifestyleInput, LifestyleListInput } from './lifestyle.schema.js';
type LifestyleService = {
  create(userId: string, input: LifestyleInput): Promise<unknown>;
  listOwn(userId: string, input: LifestyleListInput): Promise<unknown>;
  listForDoctor(userId: string, patientId: string, input: LifestyleListInput): Promise<unknown>;
  getOwn(userId: string, id: string): Promise<unknown>;
  update(userId: string, id: string, input: LifestyleInput): Promise<unknown>;
  remove(userId: string, id: string): Promise<void>;
};
export function createLifestyleController(service: LifestyleService) {
  const create: RequestHandler = async (request, response, next) => { try { response.status(201).json({ success: true, data: await service.create(response.locals.authenticatedUser!.sub, lifestyleInputSchema.parse(request.body)) }); } catch (error) { next(error); } };
  const listOwn: RequestHandler = async (request, response, next) => { try { response.json({ success: true, data: await service.listOwn(response.locals.authenticatedUser!.sub, lifestyleListSchema.parse(request.query)) }); } catch (error) { next(error); } };
  const listOwnForType = (type: 'meal' | 'activity' | 'sleep' | 'symptom'): RequestHandler => async (request, response, next) => {
    try {
      response.json({ success: true, data: await service.listOwn(response.locals.authenticatedUser!.sub, lifestyleListSchema.parse({ ...request.query, type })) });
    } catch (error) { next(error); }
  };
  const listDoctor: RequestHandler = async (request, response, next) => { try { const patientId = lifestyleIdSchema.shape.id.parse(request.params.patientId); response.json({ success: true, data: await service.listForDoctor(response.locals.authenticatedUser!.sub, patientId, lifestyleListSchema.parse(request.query)) }); } catch (error) { next(error); } };
  const get: RequestHandler = async (request, response, next) => { try { response.json({ success: true, data: await service.getOwn(response.locals.authenticatedUser!.sub, lifestyleIdSchema.parse(request.params).id) }); } catch (error) { next(error); } };
  const update: RequestHandler = async (request, response, next) => { try { response.json({ success: true, data: await service.update(response.locals.authenticatedUser!.sub, lifestyleIdSchema.parse(request.params).id, lifestyleInputSchema.parse(request.body)) }); } catch (error) { next(error); } };
  const remove: RequestHandler = async (request, response, next) => { try { await service.remove(response.locals.authenticatedUser!.sub, lifestyleIdSchema.parse(request.params).id); response.status(204).send(); } catch (error) { next(error); } };
  return { create, listOwn, listOwnForType, listDoctor, get, update, remove };
}
