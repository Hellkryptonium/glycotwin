import type { Database } from '../../config/database.js';
import type { Environment } from '../../config/env.js';
import { createRequireActiveAuth, createRequireAuth, createRequireRole, createRequireVerifiedDoctor } from '../../middleware/auth.middleware.js';
import type { AuthService } from '../auth/auth.types.js';
import { createDeviceRecordsRepository } from './device-records.repository.js';
import { createDeviceRecordsRouter } from './device-records.routes.js';
import { createGlucoseRepository } from './glucose.repository.js';
import { createGlucoseRouter } from './glucose.routes.js';
import { createGlucoseService } from './glucose.service.js';
import { createAnalyticsRepository } from './analytics.repository.js';
import { createAnalyticsRouter } from './analytics.routes.js';
import { createAnalyticsService } from './analytics.service.js';

export function createGlucoseModule(database: Database, authService: AuthService, environment: Environment) {
  const repository = createGlucoseRepository(database);
  const service = createGlucoseService(repository, authService.getCurrentUser);
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
    ).use(createDeviceRecordsRouter(authService, repository, createDeviceRecordsRepository(database), environment)),
    analyticsRouter: createAnalyticsRouter(
      analyticsService,
      createRequireAuth(authService),
      createRequireActiveAuth(authService),
      (role) => createRequireRole(role),
      createRequireVerifiedDoctor(authService),
    ),
  };
}
