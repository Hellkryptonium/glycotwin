import { Router } from 'express';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { AppError } from '../src/common/errors/app-error.js';
import type { Environment } from '../src/config/env.js';

const testEnvironment: Environment = {
  NODE_ENV: 'test',
  DEMO_MODE: false,
  PORT: 5000,
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_ISSUER: 'glycotwin-api',
  JWT_AUDIENCE: 'glycotwin-clients',
  BCRYPT_ROUNDS: 10,
  FRONTEND_ORIGIN: 'http://localhost:3000',
};

function createTestApp(databaseHealthCheck = async () => true) {
  return createApp({ environment: testEnvironment, databaseHealthCheck, authModule: null });
}

describe('health endpoints', () => {
  it('returns liveness status without checking the database', async () => {
    const response = await request(createTestApp()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { status: 'ok', service: 'glycotwin-api' },
    });
  });

  it('returns the versioned API health status', async () => {
    const response = await request(createTestApp()).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ok');
  });

  it('reports database readiness when the check succeeds', async () => {
    const response = await request(createTestApp(async () => true)).get('/api/v1/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { status: 'ready', database: 'connected' },
    });
  });

  it('returns 503 when the database check fails', async () => {
    const response = await request(createTestApp(async () => false)).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('DATABASE_UNAVAILABLE');
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
  });

  it('turns a rejected database check into a server error response', async () => {
    const response = await request(createTestApp(async () => {
      throw new Error('database connection failed');
    })).get('/health/ready');

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(response.body.error.message).toBe('An unexpected error occurred.');
  });
});

describe('application middleware', () => {
  it('returns a request ID and preserves a supplied request ID', async () => {
    const response = await request(createTestApp())
      .get('/health')
      .set('x-request-id', 'request-from-client');

    expect(response.headers['x-request-id']).toBe('request-from-client');
  });

  it('generates a request ID when none is supplied', async () => {
    const response = await request(createTestApp()).get('/health');

    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('returns a consistent error for unknown routes', async () => {
    const response = await request(createTestApp()).get('/unknown');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
  });

  it('handles malformed JSON', async () => {
    const response = await request(createTestApp())
      .post('/health')
      .set('content-type', 'application/json')
      .send('{"broken":');

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual({
      code: 'INVALID_JSON',
      message: 'Request body contains malformed JSON.',
    });
  });

  it('handles unexpected errors without exposing internal details', async () => {
    const routes = Router();
    routes.get('/test-error', () => {
      throw new AppError(418, 'TEAPOT', 'A controlled test error.');
    });
    const response = await request(createApp({
      environment: testEnvironment,
      additionalRoutes: routes,
    })).get('/test-error');

    expect(response.status).toBe(418);
    expect(response.body.error).toEqual({ code: 'TEAPOT', message: 'A controlled test error.' });
  });
});