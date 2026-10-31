import type { Database } from '../../config/database.js';
import { createRequireActiveAuth, createRequireAuth, createRequireRole, createRequireVerifiedDoctor } from '../../middleware/auth.middleware.js';
import type { AuthService } from '../auth/auth.types.js';
import { createConnectionController } from './connection.controller.js';
import { createConnectionRepository } from './connection.repository.js';
import { createConnectionRouter } from './connection.routes.js';
import { createConnectionService } from './connection.service.js';

export function createConnectionModule(database: Database, authService: AuthService) {
  const service = createConnectionService(createConnectionRepository(database), authService.getCurrentUser);
  return {
    service,
    router: createConnectionRouter(
      service,
      createRequireAuth(authService),
      createRequireActiveAuth(authService),
      (role) => createRequireRole(role),
      createRequireVerifiedDoctor(authService),
    ),
  };
}