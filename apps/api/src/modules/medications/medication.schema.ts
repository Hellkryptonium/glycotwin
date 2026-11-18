import { z } from 'zod';

const date = z.string().datetime({ offset: true }).transform((value) => new Date(value));
const text = (max: number) => z.string().trim().min(1).max(max);

export const medicationIdSchema = z.object({ id: z.string().uuid() }).strict();
export const doseIdSchema = z.object({ id: z.string().uuid(), doseId: z.string().uuid() }).strict();
export const medicationInputSchema = z.object({
  name: text(200),
  dosage: text(200),
  frequency: text(100),
  scheduleTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1).max(24),
  startDate: date,
  endDate: date.nullable().optional(),
  instructions: z.string().trim().max(2000).nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.endDate && value.endDate < value.startDate) context.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'End date must be on or after start date.' });
});
export const medicationListSchema = z.object({
  status: z.enum(['active', 'discontinued', 'all']).default('active'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export const doseInputSchema = z.object({
  scheduledAt: date,
  takenAt: date.nullable().optional(),
  status: z.enum(['taken', 'skipped', 'missed']),
}).strict().superRefine((value, context) => {
  if (value.takenAt && value.takenAt > new Date()) context.addIssue({ code: z.ZodIssueCode.custom, path: ['takenAt'], message: 'Taken time cannot be in the future.' });
  if (value.status === 'taken' && !value.takenAt) context.addIssue({ code: z.ZodIssueCode.custom, path: ['takenAt'], message: 'Taken time is required for a taken dose.' });
});
export const doseListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  from: date.optional(),
  to: date.optional(),
}).strict().superRefine((value, context) => {
  if (value.from && value.to && value.from > value.to) context.addIssue({ code: z.ZodIssueCode.custom, path: ['from'], message: 'From must be before to.' });
});
export type MedicationInput = z.infer<typeof medicationInputSchema>;
export type MedicationListInput = z.infer<typeof medicationListSchema>;
export type DoseInput = z.infer<typeof doseInputSchema>;
export type DoseListInput = z.infer<typeof doseListSchema>;
