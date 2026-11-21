import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import type { Database } from '../../config/database.js';
import { auditLogs, doctorProfiles } from '../../db/schema/index.js';
import { createRequireActiveAuth, createRequireAuth, createRequireRole } from '../../middleware/auth.middleware.js';
import type { AuthService, DoctorProfileSummary } from '../auth/auth.types.js';
import { createDoctorsRepository } from './doctors.repository.js';

const nullableText = (maximum: number) => z.string().trim().max(maximum).transform((value) => value || null).nullable().optional();
const doctorProfileInput = z.strictObject({
  fullName: z.string().trim().min(1).max(200),
  specialization: nullableText(200),
  hospitalOrClinic: nullableText(255),
  medicalRegistrationNumber: nullableText(100),
  medicalCouncil: nullableText(200),
  yearsOfExperience: z.number().int().min(0).max(100).nullable().optional(),
});

function summarizeDoctor(profile: typeof doctorProfiles.$inferSelect): DoctorProfileSummary {
  const { id, fullName, specialization, hospitalOrClinic, medicalRegistrationNumber, medicalCouncil, yearsOfExperience, verificationStatus } = profile;
  return { id, fullName, specialization, hospitalOrClinic, medicalRegistrationNumber, medicalCouncil, yearsOfExperience, verificationStatus };
}

export function createDoctorProfileRouter(database: Database, authService: AuthService, demoMode: boolean) {
  const router = Router();
  const repository = createDoctorsRepository(database);
  const requireDoctor = [createRequireAuth(authService), createRequireActiveAuth(authService), createRequireRole('doctor')];

  router.get('/doctor/profile', ...requireDoctor, async (_request, response) => {
    const user = await authService.getCurrentUser(response.locals.authenticatedUser!.sub);
    const profile = await repository.findByUserId(user.id);
    if (!profile) throw new AppError(404, 'DOCTOR_PROFILE_NOT_FOUND', 'Doctor profile was not found.');
    response.json({ success: true, data: { email: user.email, profile: summarizeDoctor(profile) } });
  });

  router.put('/doctor/profile', ...requireDoctor, async (request, response) => {
    const input = doctorProfileInput.parse(request.body);
    const user = await authService.getCurrentUser(response.locals.authenticatedUser!.sub);
    const profile = await database.transaction(async (transaction) => {
      const [previous] = await transaction.select().from(doctorProfiles).where(eq(doctorProfiles.userId, user.id)).for('update');
      if (!previous) throw new AppError(404, 'DOCTOR_PROFILE_NOT_FOUND', 'Doctor profile was not found.');
      const registrationChanged = (input.medicalRegistrationNumber !== undefined && input.medicalRegistrationNumber !== previous.medicalRegistrationNumber)
        || (input.medicalCouncil !== undefined && input.medicalCouncil !== previous.medicalCouncil);
      const [updated] = await transaction.update(doctorProfiles).set({
        ...input,
        verificationStatus: registrationChanged && !demoMode ? 'pending' : previous.verificationStatus,
        updatedAt: new Date(),
      }).where(and(eq(doctorProfiles.id, previous.id), eq(doctorProfiles.userId, user.id))).returning();
      if (!updated) throw new AppError(409, 'DOCTOR_PROFILE_UPDATED', 'Reload your profile and try again.');
      await transaction.insert(auditLogs).values({ actorUserId: user.id, action: 'doctor.profile.updated', resourceType: 'doctor_profile', resourceId: updated.id });
      return updated;
    });
    response.json({ success: true, data: { email: user.email, profile: summarizeDoctor(profile) } });
  });

  return router;
}
