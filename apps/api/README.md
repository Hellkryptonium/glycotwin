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

Never commit `.env` or real credentials. Production rejects `DEMO_MODE=true`. The development server defaults to `0.0.0.0:5050` so it does not conflict with macOS ControlCenter; Android Emulator and LAN clients can reach it.

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
- Patient profiles: `GET /patient/profile`, `PUT /patient/profile`.
- Doctor profile read: `GET /doctor/patients/:patientId/profile` for active relationships only.
- Glucose records: patient CRUD under `/patient/glucose-readings`; doctor read-only history under `/doctor/patients/:patientId/glucose-readings`.
- Glucose analytics: `GET /patient/analytics/glucose` and `GET /doctor/patients/:patientId/analytics/glucose`, with `range=7d|30d|90d`. The response contains actual readings, latest value, descriptive summary statistics, and daily averages/counts. Mixed units are returned in `byUnit` and are not silently converted.
- Lifestyle tracking: patient CRUD under `/patient/lifestyle/{meals,activities,sleep,symptoms}` and `/patient/lifestyle/timeline`; verified doctors can read `/doctor/patients/:patientId/lifestyle/timeline`. Entries are patient-owned and date-filterable.

The authoritative request schemas and response types are in `src/modules/auth` and `src/modules/connections`.

## Authentication and authorization

Passwords are hashed with bcrypt. Login returns a short-lived signed JWT access token and an opaque refresh token. Refresh tokens are rotated; only their hashes are persisted. Protected routes use bearer authentication. Doctor connection and glucose-history operations require a verified doctor, while patient operations require an active patient role. Invitation acceptance creates the relationship only after explicit patient consent. Patients own their profile and manual glucose records; verified doctors can read them only through active relationships.

## Testing

Tests use Vitest and Supertest:

```powershell
npm test
```

Analytics is read-only, uses UTC date buckets, and requires patient ownership or an active verified doctor relationship.

The test suite injects database readiness and does not require a live PostgreSQL server for the covered cases.
