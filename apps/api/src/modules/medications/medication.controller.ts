import type { RequestHandler } from 'express';
import { doseIdSchema, doseInputSchema, doseListSchema, medicationIdSchema, medicationInputSchema, medicationListSchema } from './medication.schema.js';
import type { DoseInput, DoseListInput, MedicationInput, MedicationListInput } from './medication.schema.js';

type MedicationService = {
  create(userId: string, input: MedicationInput): Promise<unknown>;
  listOwn(userId: string, input: MedicationListInput): Promise<unknown>;
  getOwn(userId: string, id: string): Promise<unknown>;
  update(userId: string, id: string, input: MedicationInput): Promise<unknown>;
  discontinue(userId: string, id: string): Promise<unknown>;
  remove(userId: string, id: string): Promise<void>;
  listDoses(userId: string, id: string, input: DoseListInput): Promise<unknown>;
  createDose(userId: string, id: string, input: DoseInput): Promise<unknown>;
  updateDose(userId: string, id: string, doseId: string, input: DoseInput): Promise<unknown>;
  doctorMedications(userId: string, patientId: string, input: MedicationListInput): Promise<unknown>;
  doctorDoses(userId: string, patientId: string, medicationId: string, input: DoseListInput): Promise<unknown>;
};

export function createMedicationController(service: MedicationService) {
  const create: RequestHandler = async (request, response, next) => { try { response.status(201).json({ success: true, data: await service.create(response.locals.authenticatedUser!.sub, medicationInputSchema.parse(request.body)) }); } catch (error) { next(error); } };
  const listOwn: RequestHandler = async (request, response, next) => { try { response.json({ success: true, data: await service.listOwn(response.locals.authenticatedUser!.sub, medicationListSchema.parse(request.query)) }); } catch (error) { next(error); } };
  const getOwn: RequestHandler = async (request, response, next) => { try { response.json({ success: true, data: await service.getOwn(response.locals.authenticatedUser!.sub, medicationIdSchema.parse(request.params).id) }); } catch (error) { next(error); } };
  const update: RequestHandler = async (request, response, next) => { try { response.json({ success: true, data: await service.update(response.locals.authenticatedUser!.sub, medicationIdSchema.parse(request.params).id, medicationInputSchema.parse(request.body)) }); } catch (error) { next(error); } };
  const discontinue: RequestHandler = async (request, response, next) => { try { response.json({ success: true, data: await service.discontinue(response.locals.authenticatedUser!.sub, medicationIdSchema.parse(request.params).id) }); } catch (error) { next(error); } };
  const remove: RequestHandler = async (request, response, next) => { try { await service.remove(response.locals.authenticatedUser!.sub, medicationIdSchema.parse(request.params).id); response.status(204).send(); } catch (error) { next(error); } };
  const listDoses: RequestHandler = async (request, response, next) => { try { response.json({ success: true, data: await service.listDoses(response.locals.authenticatedUser!.sub, medicationIdSchema.parse(request.params).id, doseListSchema.parse(request.query)) }); } catch (error) { next(error); } };
  const createDose: RequestHandler = async (request, response, next) => { try { response.status(201).json({ success: true, data: await service.createDose(response.locals.authenticatedUser!.sub, medicationIdSchema.parse(request.params).id, doseInputSchema.parse(request.body)) }); } catch (error) { next(error); } };
  const updateDose: RequestHandler = async (request, response, next) => { try { const params = doseIdSchema.parse(request.params); response.json({ success: true, data: await service.updateDose(response.locals.authenticatedUser!.sub, params.id, params.doseId, doseInputSchema.parse(request.body)) }); } catch (error) { next(error); } };
  const doctorList: RequestHandler = async (request, response, next) => { try { response.json({ success: true, data: await service.doctorMedications(response.locals.authenticatedUser!.sub, medicationIdSchema.parse({ id: request.params.patientId }).id, medicationListSchema.parse(request.query)) }); } catch (error) { next(error); } };
  const doctorDoses: RequestHandler = async (request, response, next) => { try { const patientId = medicationIdSchema.parse({ id: request.params.patientId }).id; const medicationId = medicationIdSchema.parse({ id: request.params.medicationId }).id; response.json({ success: true, data: await service.doctorDoses(response.locals.authenticatedUser!.sub, patientId, medicationId, doseListSchema.parse(request.query)) }); } catch (error) { next(error); } };
  return { create, listOwn, getOwn, update, discontinue, remove, listDoses, createDose, updateDose, doctorList, doctorDoses };
}
