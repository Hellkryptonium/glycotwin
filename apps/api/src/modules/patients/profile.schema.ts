import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null).nullable().optional();

export const profileIdSchema = z.object({
  patientId: z.string().uuid('Patient ID must be a valid UUID'),
}).strict();

export const updatePatientProfileSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(200, 'Full name is too long'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must use YYYY-MM-DD').nullable().optional(),
  gender: optionalText(100),
  diabetesType: optionalText(100),
}).strict().superRefine((value, context) => {
  if (!value.dateOfBirth) return;
  const parsed = new Date(`${value.dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value.dateOfBirth) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['dateOfBirth'], message: 'Date of birth is invalid' });
    return;
  }
  if (parsed > new Date()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['dateOfBirth'], message: 'Date of birth cannot be in the future' });
  }
});

export type UpdatePatientProfileInput = z.infer<typeof updatePatientProfileSchema>;
