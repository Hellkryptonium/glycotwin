import type { Database } from '../../config/database.js';
import { createRequireActiveAuth, createRequireAuth, createRequireRole, createRequireVerifiedDoctor } from '../../middleware/auth.middleware.js';
import type { AuthService } from '../auth/auth.types.js';
import { createGlucoseController } from './glucose.controller.js';
import { createGlucoseRepository } from './glucose.repository.js';
import { createGlucoseRouter } from './glucose.routes.js';
import { createGlucoseService } from './glucose.service.js';

export function createGlucoseModule(database: Database, authService: AuthService) {
  const service = createGlucoseService(createGlucoseRepository(database), authService.getCurrentUser);
  return {
    service,
    router: createGlucoseRouter(
      service,
      createRequireAuth(authService),
      createRequireActiveAuth(authService),
      (role) => createRequireRole(role),
      createRequireVerifiedDoctor(authService),
    ),
  };
}
