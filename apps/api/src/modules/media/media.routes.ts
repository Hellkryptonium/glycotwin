import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { MediaService } from './media.service.js';
import type { Database } from '../../config/database.js';
import { doctorProfiles, patientProfiles } from '../../db/schema/profiles.js';
import { eq } from 'drizzle-orm';

export function createMediaRouter(database: Database, service: MediaService, requireAuth: RequestHandler, requireActiveAuth: RequestHandler) {
  const router = Router();
  const limiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });
  router.use(requireAuth, requireActiveAuth);
  router.post('/uploads', limiter, async (request, response, next) => {
    try { response.status(201).json({ success: true, data: await service.createUpload(response.locals.authenticatedUser!.sub, request.body) }); } catch (error) { next(error); }
  });
  router.post('/uploads/inline', limiter, async (request, response, next) => {
    try { response.status(201).json({ success: true, data: await service.uploadInline(response.locals.authenticatedUser!.sub, request.body) }); } catch (error) { next(error); }
  });
  router.post('/assets/:id/complete', limiter, async (request, response, next) => {
    try { response.json({ success: true, data: await service.complete(response.locals.authenticatedUser!.sub, z.string().uuid().parse(request.params.id)) }); } catch (error) { next(error); }
  });
  router.get('/assets/:id/url', async (request, response, next) => {
    try { response.json({ success: true, data: await service.downloadUrl(response.locals.authenticatedUser!.sub, z.string().uuid().parse(request.params.id)) }); } catch (error) { next(error); }
  });
  router.post('/assets/:id/attach-profile-photo', limiter, async (request, response, next) => {
    try {
      const user = response.locals.authenticatedUser!;
      const asset = await service.requireReadyProfilePhoto(user.sub, z.string().uuid().parse(request.params.id));
      if (user.role === 'doctor') {
        await database.update(doctorProfiles).set({ profilePhotoAssetId: asset.id, updatedAt: new Date() }).where(eq(doctorProfiles.userId, user.sub));
      } else if (user.role === 'patient') {
        await database.update(patientProfiles).set({ profilePhotoAssetId: asset.id, updatedAt: new Date() }).where(eq(patientProfiles.userId, user.sub));
      } else {
        throw new Error('Unsupported profile role.');
      }
      response.json({ success: true, data: asset });
    } catch (error) { next(error); }
  });
  return router;
}
