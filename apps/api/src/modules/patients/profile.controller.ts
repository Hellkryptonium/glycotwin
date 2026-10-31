import type { RequestHandler } from 'express';
import { profileIdSchema, updatePatientProfileSchema } from './profile.schema.js';

export function createPatientProfileController(service: {
  getOwnProfile(userId: string): Promise<unknown>;
  updateOwnProfile(userId: string, input: unknown): Promise<unknown>;
  getForDoctor(userId: string, patientId: string): Promise<unknown>;
}) {
  const getOwnProfile: RequestHandler = async (_request, response, next) => {
    try {
      response.json({ success: true, data: await service.getOwnProfile(response.locals.authenticatedUser!.sub) });
    } catch (error) { next(error); }
  };

  const updateOwnProfile: RequestHandler = async (request, response, next) => {
    try {
      const input = updatePatientProfileSchema.parse(request.body);
      response.json({ success: true, data: await service.updateOwnProfile(response.locals.authenticatedUser!.sub, input) });
    } catch (error) { next(error); }
  };

  const getForDoctor: RequestHandler = async (request, response, next) => {
    try {
      const { patientId } = profileIdSchema.parse(request.params);
      response.json({ success: true, data: await service.getForDoctor(response.locals.authenticatedUser!.sub, patientId) });
    } catch (error) { next(error); }
  };

  return { getOwnProfile, updateOwnProfile, getForDoctor };
}
