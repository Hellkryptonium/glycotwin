import 'dotenv/config';
import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DEMO_MODE: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
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
}).superRefine((environment, context) => {
  if (environment.NODE_ENV === 'production' && environment.DEMO_MODE) {
    context.addIssue({
      code: 'custom',
      path: ['DEMO_MODE'],
      message: 'DEMO_MODE=true is not allowed when NODE_ENV=production',
    });
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