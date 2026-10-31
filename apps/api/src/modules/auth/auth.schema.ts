import { z } from 'zod';

const password = z.string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((value) => /[a-z]/.test(value), 'Password must contain a lowercase letter')
  .refine((value) => /[A-Z]/.test(value), 'Password must contain an uppercase letter')
  .refine((value) => /\d/.test(value), 'Password must contain a number');

const email = z.string().trim().email('Email must be valid').transform((value) => value.toLowerCase());
const registrationSchema = z.object({ email, password }).strict();

export const doctorRegistrationSchema = registrationSchema;
export const patientRegistrationSchema = registrationSchema;
export const loginSchema = z.object({ email, password: z.string().min(1) }).strict();
export const refreshSchema = z.object({ refreshToken: z.string().min(1).max(500) }).strict();
export const logoutSchema = refreshSchema;

export type DoctorRegistrationRequest = z.infer<typeof doctorRegistrationSchema>;
export type PatientRegistrationRequest = z.infer<typeof patientRegistrationSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;