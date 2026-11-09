import { z } from 'zod';

export const analyticsSchema = z.object({
  range: z.enum(['7d', '30d', '90d']).default('7d'),
  from: z.string().datetime({ offset: true }).transform((value) => new Date(value)).optional(),
  to: z.string().datetime({ offset: true }).transform((value) => new Date(value)).optional(),
}).strict().superRefine((value, context) => {
  if ((value.from && !value.to) || (!value.from && value.to)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['from'], message: 'From and to must be provided together' });
  }
  if (value.from && value.to && value.from > value.to) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['from'], message: 'From must be before to' });
  }
});

export type AnalyticsQuery = z.infer<typeof analyticsSchema>;
