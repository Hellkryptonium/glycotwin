import type { Database } from '../../config/database.js';
import type { Environment } from '../../config/env.js';
import { createBackblazeStorage } from '../../integration/backblaze/backblaze.client.js';
import { createRequireActiveAuth, createRequireAuth } from '../../middleware/auth.middleware.js';
import type { AuthService } from '../auth/auth.types.js';
import { createMediaRouter } from './media.routes.js';
import { createMediaService } from './media.service.js';

export function createMediaModule(database: Database, authService: AuthService, environment: Environment) {
  const service = createMediaService(database, createBackblazeStorage(environment));
  return { service, router: createMediaRouter(database, service, createRequireAuth(authService), createRequireActiveAuth(authService)) };
}
