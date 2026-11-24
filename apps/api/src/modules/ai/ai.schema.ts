import { z } from 'zod';

export const aiChatSchema = z.strictObject({
  patientProfileId: z.string().uuid('Patient profile ID must be a valid UUID'),
  message: z.string().trim().min(1, 'Message must not be empty').max(4000, 'Message is too long'),
});

export type AiChatInput = z.infer<typeof aiChatSchema>;

export const aiConversationSchema = z.strictObject({
  mode: z.enum(['GENERAL', 'PATIENT']),
  patientProfileId: z.string().uuid('Patient profile ID must be a valid UUID').nullable().optional(),
}).superRefine((value, context) => {
  if (value.mode === 'PATIENT' && !value.patientProfileId) {
    context.addIssue({ code: 'custom', path: ['patientProfileId'], message: 'Select a patient for a patient conversation.' });
  }
  if (value.mode === 'GENERAL' && value.patientProfileId) {
    context.addIssue({ code: 'custom', path: ['patientProfileId'], message: 'General conversations cannot include a patient.' });
  }
});

export const aiConversationMessageSchema = z.strictObject({
  message: z.string().trim().min(1, 'Message must not be empty').max(4000, 'Message is too long'),
});
