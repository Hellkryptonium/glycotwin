import type { Database } from '../../config/database.js';
import { createRequireActiveAuth, createRequireAuth, createRequireRole, createRequireVerifiedDoctor } from '../../middleware/auth.middleware.js';
import type { AuthService } from '../auth/auth.types.js';
import { createPatientsRepository } from './patients.repository.js';
import { createPatientProfileRouter } from './profile.routes.js';
import { createPatientProfileService } from './profile.service.js';

export function createPatientProfileModule(database: Database, authService: AuthService) {
  const service = createPatientProfileService(createPatientsRepository(database), authService.getCurrentUser);
  return {
    service,
    router: createPatientProfileRouter(
      service,
      createRequireAuth(authService),
      createRequireActiveAuth(authService),
      (role) => createRequireRole(role),
      createRequireVerifiedDoctor(authService),
    ),
  };
}
