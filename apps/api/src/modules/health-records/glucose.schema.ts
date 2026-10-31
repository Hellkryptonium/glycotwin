import { z } from 'zod';

const glucoseValue = z.string().trim().regex(/^\d+(?:\.\d{1,4})?$/, 'Glucose value must be a positive decimal').refine((value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 && numeric <= 1000;
}, 'Glucose value must be between 0 and 1000');

const measuredAt = z.string().datetime({ offset: true }).transform((value) => new Date(value)).superRefine((value, context) => {
  if (value > new Date()) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Measurement time cannot be in the future' });
});

export const glucoseIdSchema = z.object({ id: z.string().uuid('Reading ID must be a valid UUID') }).strict();

export const glucoseReadingInputSchema = z.object({
  value: glucoseValue,
  unit: z.enum(['mg/dL', 'mmol/L']),
  measuredAt,
  context: z.enum(['FASTING', 'BEFORE_MEAL', 'AFTER_MEAL', 'RANDOM']),
  notes: z.string().trim().max(1000, 'Notes are too long').nullable().optional(),
}).strict();

export const glucoseListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  from: z.string().datetime({ offset: true }).transform((value) => new Date(value)).optional(),
  to: z.string().datetime({ offset: true }).transform((value) => new Date(value)).optional(),
  context: z.enum(['FASTING', 'BEFORE_MEAL', 'AFTER_MEAL', 'RANDOM']).optional(),
}).strict().superRefine((value, context) => {
  if (value.from && value.to && value.from > value.to) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['from'], message: 'From must be before to' });
  }
});

export type GlucoseReadingInput = z.infer<typeof glucoseReadingInputSchema>;
export type GlucoseListInput = z.infer<typeof glucoseListSchema>;
