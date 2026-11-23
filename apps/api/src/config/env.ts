import 'dotenv/config';
import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DEMO_MODE: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  AUTO_APPROVE_DOCTOR_SIGNUPS: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  AI_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  GEMINI_API_KEY: z.string().trim().optional(),
  GEMINI_MODEL: z.string().trim().min(1).default('gemini-3.5-flash-lite'),
  GEMINI_LIVE_MODEL: z.string().trim().min(1).default('gemini-3.8-live'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5050),
  HOST: z.string().min(1).default('0.0.0.0'),
  DATABASE_URL: z.string().url().refine(
    (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
    'DATABASE_URL must be a PostgreSQL connection URL',
  ),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ISSUER: z.string().min(1).default('glycotwin-api'),
  JWT_AUDIENCE: z.string().min(1).default('glycotwin-clients'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  FRONTEND_ORIGIN: z.string().url(),
  B2_BUCKET: z.string().trim().min(3).optional(),
  B2_ENDPOINT: z.string().url().optional(),
  B2_KEY_ID: z.string().trim().min(1).optional(),
  B2_APPLICATION_KEY: z.string().trim().min(1).optional(),
}).superRefine((environment, context) => {
  if (environment.NODE_ENV === 'production' && environment.DEMO_MODE) {
    context.addIssue({
      code: 'custom',
      path: ['DEMO_MODE'],
      message: 'DEMO_MODE=true is not allowed when NODE_ENV=production',
    });
  }
  if (environment.AI_ENABLED && !environment.GEMINI_API_KEY) {
    context.addIssue({
      code: 'custom',
      path: ['GEMINI_API_KEY'],
      message: 'GEMINI_API_KEY is required when AI_ENABLED=true',
    });
  }
  const b2Configured = [environment.B2_BUCKET, environment.B2_ENDPOINT, environment.B2_KEY_ID, environment.B2_APPLICATION_KEY].filter(Boolean).length;
  if (b2Configured > 0 && b2Configured < 4) {
    context.addIssue({ code: 'custom', path: ['B2_BUCKET'], message: 'B2_BUCKET, B2_ENDPOINT, B2_KEY_ID, and B2_APPLICATION_KEY must be configured together.' });
  }
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(): Environment {
  const result = environmentSchema.safeParse(process.env);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');

    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return result.data;
}
