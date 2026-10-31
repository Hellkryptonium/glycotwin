import type { RequestHandler } from 'express';
import { createInvitationSchema, invitationResponseSchema, paginationSchema, patientSearchSchema, relationshipIdSchema } from './connection.schema.js';

export interface ConnectionControllerService {
  searchPatients(userId: string, email: string): Promise<unknown>;
  createInvitation(userId: string, patientId: string): Promise<unknown>;
  listInvitations(userId: string): Promise<unknown>;
  respondToInvitation(userId: string, invitationId: string, action: 'accepted' | 'declined'): Promise<unknown>;
  listConnectedPatients(userId: string, page: number, limit: number): Promise<unknown>;
  revokeRelationship(userId: string, relationshipId: string): Promise<void>;
}

export function createConnectionController(service: ConnectionControllerService) {
  const searchPatients: RequestHandler = async (request, response, next) => {
    try {
      const input = patientSearchSchema.parse({ email: request.query.email });
      response.json({ success: true, data: await service.searchPatients(response.locals.authenticatedUser!.sub, input.email) });
    } catch (error) { next(error); }
  };

  const createInvitation: RequestHandler = async (request, response, next) => {
    try {
      const input = createInvitationSchema.parse(request.body);
      response.status(201).json({ success: true, data: await service.createInvitation(response.locals.authenticatedUser!.sub, input.patientId) });
    } catch (error) { next(error); }
  };

  const listInvitations: RequestHandler = async (_request, response, next) => {
    try {
      response.json({ success: true, data: await service.listInvitations(response.locals.authenticatedUser!.sub) });
    } catch (error) { next(error); }
  };

  const respondToInvitation: RequestHandler = async (request, response, next) => {
    try {
      const { id } = relationshipIdSchema.parse(request.params);
      const input = invitationResponseSchema.parse(request.body);
      response.json({ success: true, data: { status: await service.respondToInvitation(response.locals.authenticatedUser!.sub, id, input.action) } });
    } catch (error) { next(error); }
  };

  const listConnectedPatients: RequestHandler = async (request, response, next) => {
    try {
      const input = paginationSchema.parse(request.query);
      response.json({ success: true, data: await service.listConnectedPatients(response.locals.authenticatedUser!.sub, input.page, input.limit) });
    } catch (error) { next(error); }
  };

  const revokeRelationship: RequestHandler = async (request, response, next) => {
    try {
      const { id } = relationshipIdSchema.parse(request.params);
      await service.revokeRelationship(response.locals.authenticatedUser!.sub, id);
      response.status(204).send();
    } catch (error) { next(error); }
  };

  return { searchPatients, createInvitation, listInvitations, respondToInvitation, listConnectedPatients, revokeRelationship };
}