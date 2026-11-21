import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import type { Database } from '../../config/database.js';
import { auditLogs, careItems, doctorProfiles, doctorPatientRelationships as relationships, patientProfiles, users, visitBriefs } from '../../db/schema/index.js';
import { createRequireActiveAuth, createRequireAuth, createRequireRole, createRequireVerifiedDoctor } from '../../middleware/auth.middleware.js';
import type { AuthService } from '../auth/auth.types.js';
import { createDeviceRecordsRepository } from '../health-records/device-records.repository.js';
import type { DatabaseExecutor } from '../users/users.repository.js';

const itemSchema = z.strictObject({
  kind: z.enum(['NOTE', 'GOAL', 'FOLLOW_UP']),
  title: z.string().trim().min(1).max(160),
  detail: z.string().trim().max(2000).nullable().optional(),
  dueDate: z.iso.date().nullable().optional(),
  status: z.enum(['OPEN', 'DONE']).default('OPEN'),
});

const briefSchema = z.strictObject({
  relationshipId: z.uuid(),
  title: z.string().trim().min(1).max(160),
  notes: z.string().trim().max(2000).nullable().optional(),
  eventIds: z.array(z.uuid()).min(1).max(20).refine((ids) => new Set(ids).size === ids.length, 'Choose each timeline event once.'),
});

const relationshipRequired = () => new AppError(403, 'PATIENT_RELATIONSHIP_REQUIRED', 'An active care relationship is required.');

export function createCareRouter(database: Database, authService: AuthService) {
  const router = Router();
  const records = createDeviceRecordsRepository(database);
  const requireAuth = createRequireAuth(authService);
  const patient = [requireAuth, createRequireActiveAuth(authService), createRequireRole('patient')];
  const doctor = [requireAuth, createRequireVerifiedDoctor(authService)];

  async function ownPatient(userId: string) {
    const [profile] = await database.select({ id: patientProfiles.id }).from(patientProfiles).where(eq(patientProfiles.userId, userId)).limit(1);
    if (!profile) throw new AppError(404, 'PATIENT_PROFILE_NOT_FOUND', 'Patient profile was not found.');
    return profile.id;
  }

  async function ownDoctor(userId: string) {
    const user = await authService.getCurrentUser(userId);
    if (user.doctorProfile?.verificationStatus !== 'verified') throw relationshipRequired();
    return user.doctorProfile.id;
  }

  async function briefsWithEvents(briefs: (typeof visitBriefs.$inferSelect)[], patientId: string, doctorId?: string) {
    const eventIds = [...new Set(briefs.flatMap((brief) => brief.eventIds))];
    const events = eventIds.length ? (await records.timeline(patientId, { page: 1, limit: eventIds.length }, doctorId, eventIds)).items : [];
    const byId = new Map(events.map((event) => [event.id, event]));
    return briefs.map(({ eventIds: selected, ...brief }) => ({
      ...brief,
      events: selected.flatMap((id) => {
        const event = byId.get(id);
        return event ? [event] : [];
      }),
    }));
  }

  async function audit(executor: DatabaseExecutor, actorUserId: string, action: string, resourceType: string, resourceId: string) {
    await executor.insert(auditLogs).values({ actorUserId, action, resourceType, resourceId });
  }

  router.get('/patient/care', ...patient, async (_request, response) => {
    const patientId = await ownPatient(response.locals.authenticatedUser!.sub);
    const connections = await database.select({
      id: relationships.id, doctorName: doctorProfiles.fullName, specialization: doctorProfiles.specialization,
      verificationStatus: doctorProfiles.verificationStatus,
    })
      .from(relationships).innerJoin(doctorProfiles, eq(relationships.doctorId, doctorProfiles.id))
      .innerJoin(users, eq(doctorProfiles.userId, users.id))
      .where(and(eq(relationships.patientId, patientId), eq(relationships.status, 'active'), eq(users.isActive, true)))
      .orderBy(desc(relationships.consentedAt));
    const ids = connections.map((row) => row.id);
    if (!ids.length) {
      response.json({ success: true, data: { connections, items: [], briefs: [] } });
      return;
    }
    const [items, briefs] = await Promise.all([
      database.select().from(careItems).where(and(inArray(careItems.relationshipId, ids), ne(careItems.kind, 'NOTE')))
        .orderBy(desc(careItems.updatedAt)).limit(100),
      database.select().from(visitBriefs).where(inArray(visitBriefs.relationshipId, ids)).orderBy(desc(visitBriefs.createdAt)).limit(25),
    ]);
    response.json({ success: true, data: { connections, items, briefs: await briefsWithEvents(briefs, patientId) } });
  });

  router.get('/doctor/patients/:patientId/care', ...doctor, async (request, response) => {
    const patientId = z.uuid().parse(request.params.patientId);
    const doctorId = await ownDoctor(response.locals.authenticatedUser!.sub);
    const care = await database.transaction(async (transaction) => {
      const [relation] = await transaction.select({ id: relationships.id }).from(relationships)
        .where(and(eq(relationships.patientId, patientId), eq(relationships.doctorId, doctorId), eq(relationships.status, 'active'))).for('share');
      if (!relation) throw relationshipRequired();
      const items = await transaction.select().from(careItems).where(eq(careItems.relationshipId, relation.id)).orderBy(desc(careItems.updatedAt)).limit(100);
      const briefs = await transaction.select().from(visitBriefs).where(eq(visitBriefs.relationshipId, relation.id)).orderBy(desc(visitBriefs.createdAt)).limit(25);
      return { items, briefs };
    });
    response.json({ success: true, data: { items: care.items, briefs: await briefsWithEvents(care.briefs, patientId, doctorId) } });
  });

  const saveItem: RequestHandler = async (request, response) => {
    const patientId = z.uuid().parse(request.params.patientId);
    const entryId = request.params.id ? z.uuid().parse(request.params.id) : undefined;
    const input = itemSchema.parse(request.body);
    const userId = response.locals.authenticatedUser!.sub;
    const doctorId = await ownDoctor(userId);
    const item = await database.transaction(async (transaction) => {
      const [relation] = await transaction.select({ id: relationships.id }).from(relationships)
        .where(and(eq(relationships.patientId, patientId), eq(relationships.doctorId, doctorId), eq(relationships.status, 'active'))).for('share');
      if (!relation) throw relationshipRequired();
      const values = { ...input, detail: input.detail || null, dueDate: input.dueDate ?? null };
      const [saved] = entryId
        ? await transaction.update(careItems).set({ ...values, updatedAt: new Date() }).where(and(eq(careItems.id, entryId), eq(careItems.relationshipId, relation.id))).returning()
        : await transaction.insert(careItems).values({ ...values, relationshipId: relation.id }).returning();
      if (!saved) throw new AppError(404, 'CARE_ITEM_NOT_FOUND', 'Care item was not found.');
      await audit(transaction, userId, entryId ? 'doctor.care_item.updated' : 'doctor.care_item.created', 'care_item', saved.id);
      return saved;
    });
    response.status(entryId ? 200 : 201).json({ success: true, data: item });
  };

  router.post('/doctor/patients/:patientId/care/items', ...doctor, saveItem);
  router.put('/doctor/patients/:patientId/care/items/:id', ...doctor, saveItem);

  router.post('/patient/visit-briefs', ...patient, async (request, response) => {
    const input = briefSchema.parse(request.body);
    const userId = response.locals.authenticatedUser!.sub;
    const patientId = await ownPatient(userId);
    const matched = await records.timeline(patientId, { page: 1, limit: input.eventIds.length }, undefined, input.eventIds);
    if (matched.items.length !== input.eventIds.length) throw new AppError(400, 'INVALID_BRIEF_EVENTS', 'Choose events from your own existing timeline.');
    const brief = await database.transaction(async (transaction) => {
      const [relation] = await transaction.select({ id: relationships.id }).from(relationships)
        .innerJoin(doctorProfiles, eq(relationships.doctorId, doctorProfiles.id))
        .innerJoin(users, eq(users.id, doctorProfiles.userId))
        .where(and(eq(relationships.id, input.relationshipId), eq(relationships.patientId, patientId), eq(relationships.status, 'active'),
          eq(doctorProfiles.verificationStatus, 'verified'), eq(users.isActive, true))).for('share');
      if (!relation) throw relationshipRequired();
      const [saved] = await transaction.insert(visitBriefs).values({ ...input, notes: input.notes || null }).returning();
      if (!saved) throw new Error('Visit brief insert returned no row.');
      await audit(transaction, userId, 'patient.visit_brief.shared', 'visit_brief', saved.id);
      return saved;
    });
    const [data] = await briefsWithEvents([brief], patientId);
    response.status(201).json({ success: true, data });
  });

  router.delete('/patient/visit-briefs/:id', ...patient, async (request, response) => {
    const id = z.uuid().parse(request.params.id);
    const userId = response.locals.authenticatedUser!.sub;
    const patientId = await ownPatient(userId);
    await database.transaction(async (transaction) => {
      const owned = transaction.select({ id: relationships.id }).from(relationships).where(eq(relationships.patientId, patientId));
      const [removed] = await transaction.delete(visitBriefs).where(and(eq(visitBriefs.id, id), inArray(visitBriefs.relationshipId, owned))).returning({ id: visitBriefs.id });
      if (!removed) throw new AppError(404, 'VISIT_BRIEF_NOT_FOUND', 'Visit brief was not found.');
      await audit(transaction, userId, 'patient.visit_brief.withdrawn', 'visit_brief', removed.id);
    });
    response.status(204).send();
  });

  return router;
}
