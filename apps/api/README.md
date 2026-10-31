# GlycoTwin API

The API is the authenticated application boundary for the doctor dashboard and patient Android app. It owns validation, authentication, authorization, consent workflow, audit events, and PostgreSQL access.

## Architecture

The service is an Express 5 and TypeScript modular monolith. Feature modules under `src/modules` contain routes, controllers, schemas, services, and repositories. Drizzle ORM maps the PostgreSQL schema in `src/db/schema`; migrations are under `drizzle/`. Pino provides request/error logging with authorization and cookie redaction.

## Environment

Copy `.env.example` to `.env` and set values locally:

- `NODE_ENV`
- `DEMO_MODE`
- `PORT`
- `HOST`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `BCRYPT_ROUNDS`
- `FRONTEND_ORIGIN`

Never commit `.env` or real credentials. Production rejects `DEMO_MODE=true`. The development server defaults to `0.0.0.0:5000` so Android Emulator and LAN clients can reach it.

## Commands

```powershell
npm install
npm run typecheck
npm test
npm run build
npm run dev
npm start
```

Database commands:

```powershell
npm run db:generate
npm run db:migrate
npm run db:studio
```

Migrations are forward-only and must be reviewed before production use.

## API prefix and endpoint groups

All application endpoints use `/api/v1`.

- Health: `GET /health`, `GET /api/v1/health`, and readiness endpoints.
- Authentication: `/auth/register/doctor`, `/auth/register/patient`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`.
- Doctor connections: `/doctor/patients/search`, `/doctor/invitations`, `/doctor/patients`.
- Patient connections: `/patient/invitations`, `/patient/invitations/:id/respond`, `/patient/relationships/:id/revoke`.

The authoritative request schemas and response types are in `src/modules/auth` and `src/modules/connections`.

## Authentication and authorization

Passwords are hashed with bcrypt. Login returns a short-lived signed JWT access token and an opaque refresh token. Refresh tokens are rotated; only their hashes are persisted. Protected routes use bearer authentication. Doctor connection operations require a verified doctor, while patient connection operations require an active patient role. Invitation acceptance creates the relationship only after explicit patient consent.

## Testing

Tests use Vitest and Supertest:

```powershell
npm test
```

The test suite injects database readiness and does not require a live PostgreSQL server for the covered cases.
