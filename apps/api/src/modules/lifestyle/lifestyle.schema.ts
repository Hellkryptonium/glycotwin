import { z } from 'zod';

const occurredAt = z.string().datetime({ offset: true }).transform((value) => new Date(value)).superRefine((value, context) => {
  if (value > new Date()) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Event time cannot be in the future' });
});
const notes = z.string().trim().max(1000).nullable().optional();
export const lifestyleIdSchema = z.object({ id: z.string().uuid() }).strict();
export const lifestyleListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  from: z.string().datetime({ offset: true }).transform((value) => new Date(value)).optional(),
  to: z.string().datetime({ offset: true }).transform((value) => new Date(value)).optional(),
  type: z.enum(['meal', 'activity', 'sleep', 'symptom']).optional(),
}).strict().superRefine((value, context) => {
  if (value.from && value.to && value.from > value.to) context.addIssue({ code: z.ZodIssueCode.custom, path: ['from'], message: 'From must be before to' });
});
const base = z.object({ occurredAt, notes });
export const lifestyleInputSchema = z.discriminatedUnion('type', [
  base.extend({ type: z.literal('meal'), mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'other']), description: z.string().trim().min(1).max(2000), activityType: z.undefined().optional(), durationMinutes: z.undefined().optional(), sleepDurationMinutes: z.undefined().optional() }),
  base.extend({ type: z.literal('activity'), activityType: z.string().trim().min(1).max(100), durationMinutes: z.number().int().min(1).max(1440), description: z.string().trim().max(2000).optional(), mealType: z.undefined().optional(), sleepDurationMinutes: z.undefined().optional() }),
  base.extend({ type: z.literal('sleep'), sleepDurationMinutes: z.number().int().min(1).max(1440), description: z.string().trim().max(2000).optional(), mealType: z.undefined().optional(), activityType: z.undefined().optional(), durationMinutes: z.undefined().optional() }),
  base.extend({ type: z.literal('symptom'), description: z.string().trim().min(1).max(2000), mealType: z.undefined().optional(), activityType: z.undefined().optional(), durationMinutes: z.undefined().optional(), sleepDurationMinutes: z.undefined().optional() }),
]);
export type LifestyleInput = z.infer<typeof lifestyleInputSchema>;
export type LifestyleListInput = z.infer<typeof lifestyleListSchema>;
