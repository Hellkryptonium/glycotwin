import type { ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../common/errors/app-error.js';

export const errorMiddleware: ErrorRequestHandler = (error, request, response, _next) => {
  const requestId = response.locals.requestId;
  const isMalformedJson = error instanceof SyntaxError && 'body' in error;
  const isValidationError = error instanceof z.ZodError;
  const appError = isMalformedJson
    ? new AppError(400, 'INVALID_JSON', 'Request body contains malformed JSON.')
    : isValidationError
      ? new AppError(400, 'VALIDATION_ERROR', error.issues[0]?.message ?? 'Request input is invalid.')
    : error instanceof AppError
      ? error
      : undefined;

  const statusCode = appError?.statusCode ?? 500;
  const code = appError?.code ?? 'INTERNAL_SERVER_ERROR';
  const message = appError?.message ?? 'An unexpected error occurred.';

  if (statusCode >= 500) {
    request.log?.error({ err: error, requestId }, 'Unhandled request error');
  }

  response.status(statusCode).json({
    success: false,
    error: { code, message },
    requestId,
  });
};