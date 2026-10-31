import { z } from 'zod';

export const patientSearchSchema = z.object({
  email: z.string().trim().email('Email must be valid').transform((value) => value.toLowerCase()),
}).strict();

export const createInvitationSchema = z.object({
  patientId: z.string().uuid('Patient ID must be a valid UUID'),
}).strict();

export const invitationResponseSchema = z.object({
  action: z.enum(['accepted', 'declined']),
}).strict();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

export const relationshipIdSchema = z.object({
  id: z.string().uuid('Relationship ID must be a valid UUID'),
}).strict();