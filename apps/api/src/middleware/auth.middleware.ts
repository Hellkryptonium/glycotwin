import type { RequestHandler } from 'express';
import { AppError } from '../common/errors/app-error.js';
import type { AccessTokenClaims, UserRole } from '../modules/auth/auth.types.js';

export interface AccessTokenVerifier {
  verifyAccessToken(token: string): Promise<AccessTokenClaims>;
}

export interface ActiveUserVerifier extends AccessTokenVerifier {
  getCurrentUser(userId: string): Promise<{
    id: string;
    role: UserRole;
    isActive: boolean;
    doctorProfile?: { verificationStatus: 'pending' | 'verified' | 'rejected' };
  }>;
}

export function createRequireAuth(verifier: AccessTokenVerifier): RequestHandler {
  return async (request, response, next) => {
    try {
      const authorization = request.header('authorization');
      const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : null;
      if (!token) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
      }
      response.locals.authenticatedUser = await verifier.verifyAccessToken(token);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function createRequireRole(...roles: UserRole[]): RequestHandler {
  return (_request, response, next) => {
    const user = response.locals.authenticatedUser;
    if (!user || !roles.includes(user.role)) {
      next(new AppError(403, 'FORBIDDEN', 'You do not have permission to access this resource.'));
      return;
    }
    next();
  };
}

export function createRequireActiveAuth(verifier: ActiveUserVerifier): RequestHandler {
  return async (_request, response, next) => {
    try {
      const tokenUser = response.locals.authenticatedUser;
      if (!tokenUser) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
      }
      await verifier.getCurrentUser(tokenUser.sub);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function createRequireVerifiedDoctor(verifier: ActiveUserVerifier): RequestHandler {
  return async (_request, response, next) => {
    try {
      const tokenUser = response.locals.authenticatedUser;
      if (!tokenUser) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
      }
      const user = await verifier.getCurrentUser(tokenUser.sub);
      if (user.role !== 'doctor' || user.doctorProfile?.verificationStatus !== 'verified') {
        throw new AppError(403, 'DOCTOR_VERIFICATION_REQUIRED', 'A verified doctor account is required.');
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}