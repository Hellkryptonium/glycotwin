import type { Database } from '../../config/database.js';
import { createRequireActiveAuth, createRequireAuth, createRequireRole, createRequireVerifiedDoctor } from '../../middleware/auth.middleware.js';
import type { AuthService } from '../auth/auth.types.js';
import { createGlucoseController } from './glucose.controller.js';
import { createGlucoseRepository } from './glucose.repository.js';
import { createGlucoseRouter } from './glucose.routes.js';
import { createGlucoseService } from './glucose.service.js';
import { createAnalyticsRepository } from './analytics.repository.js';
import { createAnalyticsRouter } from './analytics.routes.js';
import { createAnalyticsService } from './analytics.service.js';

export function createGlucoseModule(database: Database, authService: AuthService) {
  const service = createGlucoseService(createGlucoseRepository(database), authService.getCurrentUser);
  const repository = createGlucoseRepository(database);
  const analyticsService = createAnalyticsService(
    createAnalyticsRepository(database),
    authService.getCurrentUser,
    repository.findPatientByUserId,
    repository.findPatientForDoctor,
  );
  return {
    service,
    router: createGlucoseRouter(
      service,
      createRequireAuth(authService),
      createRequireActiveAuth(authService),
      (role) => createRequireRole(role),
      createRequireVerifiedDoctor(authService),
    ),
    analyticsRouter: createAnalyticsRouter(
      analyticsService,
      createRequireAuth(authService),
      createRequireActiveAuth(authService),
      (role) => createRequireRole(role),
      createRequireVerifiedDoctor(authService),
    ),
  };
}
