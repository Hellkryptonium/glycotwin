import { Router } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import type { Environment } from '../../config/env.js';
import { createRequireActiveAuth, createRequireAuth, createRequireRole, createRequireVerifiedDoctor } from '../../middleware/auth.middleware.js';
import type { AuthService } from '../auth/auth.types.js';
import type { createDeviceRecordsRepository } from './device-records.repository.js';
import { deviceActivityInputSchema, glucoseImportSchema, timelineInputSchema } from './device-records.schema.js';
import type { createGlucoseRepository } from './glucose.repository.js';
import { glucoseIdSchema } from './glucose.schema.js';

const replayPoints = [[-60, '102'], [-55, '106'], [-50, '112'], [-45, '126'], [-40, '148'], [-20, '172'], [-15, '161'], [-10, '149'], [-5, '138'], [0, '129']] as const;
const replayWindowMs = 15 * 60 * 1000;

export function createDeviceRecordsRouter(
  authService: AuthService,
  profiles: Pick<ReturnType<typeof createGlucoseRepository>, 'findPatientByUserId' | 'findPatientForDoctor'>,
  records: ReturnType<typeof createDeviceRecordsRepository>,
  environment: Environment,
) {
  const router = Router();
  const requireAuth = createRequireAuth(authService);
  const patient = [requireAuth, createRequireActiveAuth(authService), createRequireRole('patient')];
  const doctor = [requireAuth, createRequireVerifiedDoctor(authService)];
  const databaseHost = new URL(environment.DATABASE_URL).hostname;
  const replayEnabled = environment.DEMO_MODE && environment.NODE_ENV === 'development'
    && ['127.0.0.1', 'localhost', '[::1]'].includes(databaseHost);

  async function patientId(userId: string) {
    const profile = await profiles.findPatientByUserId(userId);
    if (!profile) throw new AppError(404, 'PATIENT_PROFILE_NOT_FOUND', 'Patient profile was not found.');
    return profile.id;
  }

  async function requireReplayAccount(userId: string) {
    if (replayEnabled && (await authService.getCurrentUser(userId)).email.toLowerCase().endsWith('@example.test')) return;
    throw new AppError(403, 'LOCAL_REPLAY_ONLY', 'Replay requires demo mode, a local database, and an @example.test patient account.');
  }

  router.post('/patient/glucose-readings/import', ...patient, async (request, response) => {
    const { readings } = glucoseImportSchema.parse(request.body);
    const userId = response.locals.authenticatedUser!.sub;
    const data = await records.insertGlucose(await patientId(userId), userId, 'HEALTH_CONNECT', readings);
    response.json({ success: true, data });
  });

  router.post('/patient/glucose-readings/replay', ...patient, async (_request, response) => {
    const userId = response.locals.authenticatedUser!.sub;
    await requireReplayAccount(userId);
    const anchor = Math.floor(Date.now() / replayWindowMs) * replayWindowMs;
    const readings = replayPoints.map(([offsetMinutes, value]) => ({
      externalId: `demo-v1:${anchor}:${offsetMinutes}`,
      value,
      unit: 'mg/dL' as const,
      measuredAt: new Date(anchor + offsetMinutes * 60_000),
    }));
    const data = await records.insertGlucose(await patientId(userId), userId, 'REPLAY', readings);
    response.json({ success: true, data });
  });

  router.post('/patient/device-activity', ...patient, async (request, response) => {
    const { events } = deviceActivityInputSchema.parse(request.body);
    const userId = response.locals.authenticatedUser!.sub;
    if (events.some((event) => event.simulated)) await requireReplayAccount(userId);
    const data = await records.insertActivity(await patientId(userId), userId, events);
    response.json({ success: true, data });
  });

  router.get('/patient/timeline', ...patient, async (request, response) => {
    const input = timelineInputSchema.parse(request.query);
    const data = await records.timeline(await patientId(response.locals.authenticatedUser!.sub), input);
    response.json({ success: true, data });
  });

  router.get('/doctor/patients/:patientId/timeline', ...doctor, async (request, response) => {
    const input = timelineInputSchema.parse(request.query);
    const id = glucoseIdSchema.shape.id.parse(request.params.patientId);
    const user = await authService.getCurrentUser(response.locals.authenticatedUser!.sub);
    if (!user.doctorProfile || !await profiles.findPatientForDoctor(id, user.doctorProfile.id)) {
      throw new AppError(403, 'PATIENT_RELATIONSHIP_REQUIRED', 'An active patient relationship is required.');
    }
    const data = await records.timeline(id, input, user.doctorProfile.id);
    response.json({ success: true, data });
  });

  return router;
}
