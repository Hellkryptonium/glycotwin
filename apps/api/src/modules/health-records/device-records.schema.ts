import { z } from 'zod';
import { glucoseValue, measuredAt } from './glucose.schema.js';

const isoDate = z.iso.datetime({ offset: true });

export const glucoseImportSchema = z.strictObject({
  readings: z.array(z.strictObject({
    externalId: z.string().trim().min(1).max(255),
    value: glucoseValue,
    unit: z.enum(['mg/dL', 'mmol/L']),
    measuredAt,
    deviceOrigin: z.string().trim().min(1).max(255).optional(),
  })).min(1).max(500),
});

const commonActivity = {
  eventId: z.uuid(),
  measuredAt,
  simulated: z.boolean().optional(),
};
const activityEvent = z.discriminatedUnion('kind', [
  z.strictObject({
    ...commonActivity,
    kind: z.literal('steps'),
    value: z.number().int().positive().max(100_000),
    startedAt: isoDate.transform((value) => new Date(value)).optional(),
  }),
  z.strictObject({ ...commonActivity, kind: z.literal('heart_rate'), value: z.number().positive().max(300) }),
  z.strictObject({
    ...commonActivity,
    kind: z.literal('workout'),
    startedAt: isoDate.transform((value) => new Date(value)),
    activityType: z.string().trim().min(1).max(100),
  }),
]).superRefine((event, context) => {
  if ('startedAt' in event && event.startedAt && event.startedAt >= event.measuredAt) {
    context.addIssue({ code: 'custom', path: ['startedAt'], message: 'Start time must precede measurement time.' });
  }
});

export const deviceActivityInputSchema = z.strictObject({ events: z.array(activityEvent).min(1).max(100) });

export const timelineInputSchema = z.strictObject({
  from: isoDate.optional(),
  to: isoDate.optional(),
  source: z.enum(['MANUAL', 'CGM', 'REPLAY', 'WATCH', 'HEALTH_CONNECT']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
}).refine((input) => !input.from || !input.to || Date.parse(input.from) <= Date.parse(input.to), {
  path: ['from'], message: 'From must be before to.',
});

export type GlucoseImportRow = z.infer<typeof glucoseImportSchema>['readings'][number];
export type DeviceActivityEvent = z.infer<typeof activityEvent>;
export type TimelineInput = z.infer<typeof timelineInputSchema>;
