import type { Request, RequestHandler, Response } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import type { Environment } from '../../config/env.js';
import { accountDeleteSchema, accountPasswordSchema, loginSchema, refreshSchema } from './auth.schema.js';
import type { AuthService, AuthTokens } from './auth.types.js';

export type AuthControllerService = AuthService;
const refreshCookie = 'glycotwin_refresh';

export function createAuthController(service: AuthControllerService, environment?: Pick<Environment, 'FRONTEND_ORIGIN' | 'NODE_ENV'>) {
  const cookieOptions = { httpOnly: true, secure: environment?.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/backend/auth' };

  function startsWebSession(request: Request) {
    if (request.get('X-GlycoTwin-Client') !== 'web') return false;
    if (!environment || request.get('origin') !== new URL(environment.FRONTEND_ORIGIN).origin) {
      throw new AppError(403, 'WEB_ORIGIN_REQUIRED', 'Use the dashboard origin for this action.');
    }
    return true;
  }

  function sendSession<T extends AuthTokens>(response: Response, tokens: T, web: boolean, status = 200) {
    if (web) {
      const { refreshToken, ...data } = tokens;
      response.cookie(refreshCookie, refreshToken, { ...cookieOptions, expires: tokens.sessionExpiresAt });
      response.status(status).json({ success: true, data });
    } else {
      response.status(status).json({ success: true, data: tokens });
    }
  }

  function readWebRefresh(request: Request) {
    const cookie = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${refreshCookie}=`));
    return cookie?.slice(refreshCookie.length + 1);
  }

  const registerDoctor: RequestHandler = async (request, response) => {
    const web = startsWebSession(request);
    sendSession(response, await service.registerDoctor(request.body), web, 201);
  };
  const registerPatient: RequestHandler = async (request, response) => {
    const web = startsWebSession(request);
    sendSession(response, await service.registerPatient(request.body), web, 201);
  };
  const login: RequestHandler = async (request, response) => {
    const web = startsWebSession(request);
    const input = loginSchema.parse(request.body);
    sendSession(response, await service.login(input.email, input.password), web);
  };
  const refresh: RequestHandler = async (request, response) => {
    const web = startsWebSession(request);
    const token = web ? readWebRefresh(request) : refreshSchema.parse(request.body).refreshToken;
    if (!token) throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired.');
    try {
      sendSession(response, await service.refresh(token), web);
    } catch (error) {
      if (web && error instanceof AppError && error.statusCode === 401) response.clearCookie(refreshCookie, cookieOptions);
      throw error;
    }
  };
  const logout: RequestHandler = async (request, response) => {
    const web = startsWebSession(request);
    const token = web ? readWebRefresh(request) : refreshSchema.parse(request.body).refreshToken;
    await service.logout(token ?? null);
    if (web) response.clearCookie(refreshCookie, cookieOptions);
    response.status(204).send();
  };
  const me: RequestHandler = async (_request, response) => {
    response.json({ success: true, data: await service.getCurrentUser(response.locals.authenticatedUser!.sub) });
  };
  const deleteAccount: RequestHandler = async (request, response) => {
    const web = startsWebSession(request);
    const { currentPassword } = accountDeleteSchema.parse(request.body);
    await service.deleteAccount(response.locals.authenticatedUser!.sub, currentPassword);
    if (web) response.clearCookie(refreshCookie, cookieOptions);
    response.status(204).send();
  };
  const changePassword: RequestHandler = async (request, response) => {
    const web = startsWebSession(request);
    await service.changePassword(response.locals.authenticatedUser!.sub, accountPasswordSchema.parse(request.body));
    if (web) response.clearCookie(refreshCookie, cookieOptions);
    response.status(204).send();
  };
  return { registerDoctor, registerPatient, login, refresh, logout, me, deleteAccount, changePassword };
}
