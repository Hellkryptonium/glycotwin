import type { RequestHandler } from 'express';
import { loginSchema, logoutSchema, refreshSchema } from './auth.schema.js';
import type { AuthenticatedUser } from './auth.types.js';

export interface AuthControllerService {
  registerDoctor(input: unknown): Promise<unknown>;
  registerPatient(input: unknown): Promise<unknown>;
  login(email: string, password: string): Promise<unknown>;
  refresh(refreshToken: string): Promise<unknown>;
  logout(refreshToken: string, userId: string): Promise<void>;
  getCurrentUser(userId: string): Promise<AuthenticatedUser>;
}

export function createAuthController(service: AuthControllerService) {
  const registerDoctor: RequestHandler = async (request, response, next) => {
    try {
      response.status(201).json({ success: true, data: await service.registerDoctor(request.body) });
    } catch (error) {
      next(error);
    }
  };

  const registerPatient: RequestHandler = async (request, response, next) => {
    try {
      response.status(201).json({ success: true, data: await service.registerPatient(request.body) });
    } catch (error) {
      next(error);
    }
  };

  const login: RequestHandler = async (request, response, next) => {
    try {
      const input = loginSchema.parse(request.body);
      response.json({ success: true, data: await service.login(input.email, input.password) });
    } catch (error) {
      next(error);
    }
  };

  const refresh: RequestHandler = async (request, response, next) => {
    try {
      const input = refreshSchema.parse(request.body);
      response.json({ success: true, data: await service.refresh(input.refreshToken) });
    } catch (error) {
      next(error);
    }
  };

  const logout: RequestHandler = async (_request, response, next) => {
    try {
      const input = logoutSchema.parse(_request.body);
      await service.logout(input.refreshToken, response.locals.authenticatedUser!.sub);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  const me: RequestHandler = async (_request, response, next) => {
    try {
      response.json({ success: true, data: await service.getCurrentUser(response.locals.authenticatedUser!.sub) });
    } catch (error) {
      next(error);
    }
  };

  return { registerDoctor, registerPatient, login, refresh, logout, me };
}