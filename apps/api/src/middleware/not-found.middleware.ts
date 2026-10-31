import type { RequestHandler } from 'express';
import { AppError } from '../common/errors/app-error.js';

export const notFoundMiddleware: RequestHandler = (request, _response, next) => {
  next(new AppError(404, 'NOT_FOUND', `Route ${request.method} ${request.path} not found.`));
};