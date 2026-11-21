import { z } from 'zod';

const commonPasswords = new Set([
  '12345678', '123456789', '1234567890', '11111111', '00000000', 'password', 'password1', 'password123',
  'qwerty123', 'qwertyuiop', 'abc12345', 'letmein123', 'iloveyou', 'welcome1', 'admin123', 'glycotwin',
]);
const password = z.string().max(256)
  .refine((value) => Array.from(value).length >= 8, 'Password must be at least 8 characters')
  .refine((value) => Array.from(value).length <= 128, 'Password must be at most 128 characters')
  .refine((value) => !commonPasswords.has(value.trim().toLowerCase()) && value.trim().length > 0,
    'Choose a password that is harder to guess');

const email = z.string().trim().email('Email must be valid').transform((value) => value.toLowerCase());
const currentPassword = z.string().min(1).max(256);
const registrationSchema = z.object({ email, password }).strict();

export const doctorRegistrationSchema = registrationSchema;
export const patientRegistrationSchema = registrationSchema;
export const loginSchema = z.object({ email, password: currentPassword }).strict();
export const refreshSchema = z.object({ refreshToken: z.string().min(1).max(500) }).strict();
export const accountPasswordSchema = z.strictObject({ currentPassword, newPassword: password });
export const accountDeleteSchema = z.strictObject({ currentPassword });

export type DoctorRegistrationRequest = z.infer<typeof doctorRegistrationSchema>;
export type PatientRegistrationRequest = z.infer<typeof patientRegistrationSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
