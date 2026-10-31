import rateLimit from 'express-rate-limit';
import { Router } from 'express';
import type { Database } from '../../config/database.js';
import type { Environment } from '../../config/env.js';
import { createRequireAuth } from '../../middleware/auth.middleware.js';
import { createAuthController, type AuthControllerService } from './auth.controller.js';
import { createAuthRepository } from './auth.repository.js';
import { createAuthService } from './auth.service.js';
import type { AuthService } from './auth.types.js';
import { createBcryptPasswordHasher } from './auth.service.js';
import { createUsersService } from '../users/users.service.js';
import { createUsersRepository } from '../users/users.repository.js';

export interface AuthModule {
  router: Router;
  service: AuthService;
}

export function createAuthRouter(service: AuthControllerService, requireAuth: ReturnType<typeof createRequireAuth>): Router {
  const router = Router();
  const controller = createAuthController(service);
  const authenticationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });

  router.use(authenticationLimiter);
  router.post('/register/doctor', controller.registerDoctor);
  router.post('/register/patient', controller.registerPatient);
  router.post('/login', controller.login);
  router.post('/refresh', controller.refresh);
  router.post('/logout', requireAuth, controller.logout);
  router.get('/me', requireAuth, controller.me);
  return router;
}

export function createAuthModule(database: Database, environment: Environment): AuthModule {
  const userRepository = createUsersRepository(database);
  const service = createAuthService({
    environment,
    userService: createUsersService(database, { demoMode: environment.DEMO_MODE }),
    userRepository,
    authRepository: createAuthRepository(database),
    passwordHasher: createBcryptPasswordHasher(environment.BCRYPT_ROUNDS),
  });
  return {
    service,
    router: createAuthRouter(service, createRequireAuth(service)),
  };
}