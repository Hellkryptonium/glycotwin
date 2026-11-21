import rateLimit from 'express-rate-limit';
import { Router } from 'express';
import type { Database } from '../../config/database.js';
import type { Environment } from '../../config/env.js';
import { createRequireAuth } from '../../middleware/auth.middleware.js';
import { createAuthController, type AuthControllerService } from './auth.controller.js';
import { createAuthRepository } from './auth.repository.js';
import { createAuthService, createPasswordHasher } from './auth.service.js';
import type { AuthService } from './auth.types.js';
import { createUsersService } from '../users/users.service.js';
import { createUsersRepository } from '../users/users.repository.js';

export interface AuthModule {
  router: Router;
  service: AuthService;
}

export function createAuthRouter(service: AuthControllerService, requireAuth: ReturnType<typeof createRequireAuth>, environment?: Environment): Router {
  const router = Router();
  const controller = createAuthController(service, environment);
  const authenticationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });

  router.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });

  router.post('/register/doctor', authenticationLimiter, controller.registerDoctor);
  router.post('/register/patient', authenticationLimiter, controller.registerPatient);
  router.post('/login', authenticationLimiter, controller.login);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  router.delete('/account', authenticationLimiter, requireAuth, controller.deleteAccount);
  router.put('/account/password', authenticationLimiter, requireAuth, controller.changePassword);
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
    passwordHasher: createPasswordHasher(),
  });
  return {
    service,
    router: createAuthRouter(service, createRequireAuth(service), environment),
  };
}
