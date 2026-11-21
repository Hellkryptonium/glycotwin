# GlycoTwin API

The API is the authenticated application boundary for the doctor dashboard and patient Android app. It owns validation, authentication, authorization, consent workflow, audit events, and PostgreSQL access.

## Architecture

The service is an Express 5 and TypeScript modular monolith. Feature modules under `src/modules` contain routes, controllers, schemas, services, and repositories. Drizzle ORM maps the PostgreSQL schema in `src/db/schema`; migrations are under `drizzle/`. Pino provides request/error logging with authorization and cookie redaction.

## Environment

Copy `.env.example` to `.env` and set values locally:

- `NODE_ENV`
- `DEMO_MODE`
- `AUTO_APPROVE_DOCTOR_SIGNUPS` (default `false`): set to `true` for a synthetic beta to grant new doctor accounts immediate access to clinician features. Patient approval is still required for access to patient records. This applies to every new doctor signup and does not update existing profiles.
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

For a loopback Docker PostgreSQL database and a shell-only `DATABASE_URL` override, see the [local development guide](../../docs/development/development-guide.md#docker-postgresql).

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
- Authentication: `/auth/register/doctor`, `/auth/register/patient`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`. Signup and sign-in open a seven-day session.
- Account management: `PUT /auth/account/password` and `DELETE /auth/account` require `currentPassword`.
- Doctor connections: `/doctor/patients/search`, `/doctor/invitations`, `/doctor/patients`.
- Patient connections: `/patient/invitations`, `/patient/invitations/:id/respond`, `/patient/relationships/:id/revoke`.
- Patient profiles: `GET /patient/profile`, `PUT /patient/profile`.
- Doctor profile read: `GET /doctor/patients/:patientId/profile` for active relationships only.
- Doctor's own profile: `GET /doctor/profile` and `PUT /doctor/profile`. Changes to medical registration details require a new verification review outside demo mode.
- Glucose records: patient CRUD under `/patient/glucose-readings`; doctor read-only history under `/doctor/patients/:patientId/glucose-readings`.
- Device imports: `POST /patient/glucose-readings/import` accepts Health Connect glucose with a stable external ID, device origin, unit, and measurement time. `POST /patient/device-activity` accepts permission-gated watch activity. Repeated imports return inserted and duplicate counts. The server records first receipt time separately from measurement time.
- Shared timeline: `GET /patient/timeline` and `GET /doctor/patients/:patientId/timeline` combine glucose, lifestyle, taken doses, and watch activity with `from`, `to`, `source`, `page`, and `limit` filters. Doctor access requires an active relationship.
- Local replay: `POST /patient/glucose-readings/replay` serves a synthetic trace in local development demo mode for `@example.test` patient accounts. Simulated watch events use the same restriction. The timeline labels both as replay, and regular glucose analytics exclude replay.
- Glucose analytics: `GET /patient/analytics/glucose` and `GET /doctor/patients/:patientId/analytics/glucose`, with `range=7d|30d|90d`. The response contains actual readings, latest value, descriptive summary statistics, and daily averages/counts. Mixed units are returned in `byUnit` and are not silently converted.
- Lifestyle tracking: patient CRUD under `/patient/lifestyle/{meals,activities,sleep,symptoms}` and `/patient/lifestyle/timeline`; verified doctors can read `/doctor/patients/:patientId/lifestyle/timeline`. Entries are patient-owned and date-filterable.
  Meals accept an optional `carbohydrateGrams` estimate in grams. Responses use `null` for unknown and return an explicit zero when entered. Updating a meal without this field preserves its estimate. Send `carbohydrateGrams: null` or `clearCarbohydrateGrams: true` to remove it.
- Medication tracking: patients manage `/patient/medications` and `/patient/medications/:id/doses`; verified doctors can read `/doctor/patients/:patientId/medications` and dose history through active relationships. Medication and dose changes are audited.
- Care workspace: `GET /patient/care` and `GET /doctor/patients/:patientId/care` expose shared goals, follow-ups, and patient-selected visit briefs. Clinicians can create and update care items through `/doctor/patients/:patientId/care/items`. Patients can create or withdraw a brief through `/patient/visit-briefs`.

The authoritative request schemas and response types are in `src/modules/auth` and `src/modules/connections`.

## Authentication and authorization

New passwords use scrypt and existing bcrypt passwords are accepted. Login and signup return a short-lived signed JWT access token. Native clients receive an opaque rotating refresh token. The Next.js proxy keeps the browser refresh credential in an `HttpOnly` and `SameSite=Strict` cookie, with `Secure` enabled in production. The backend enforces a fixed seven-day limit from signup or sign-in. Protected routes use bearer authentication and check the active server-side session. Verified doctor access requires an active care relationship granted by the patient. Clinician notes stay with the relationship and are visible to the authoring doctor.

## Testing

Tests use Vitest and Supertest:

```powershell
npm test
```

Analytics is read-only, uses UTC date buckets, and requires patient ownership or an active verified doctor relationship.
Medication records are entered by patients only. The `0005_sour_wasp.sql` forward migration adds `medications` and `medication_doses`; no reminders, recommendations, or clinical adherence interpretation are provided.

The regular test suite runs without PostgreSQL. The opt-in device records integration test uses the [local Docker replay setup](../../docs/development/development-guide.md#phone-watch-and-dashboard-replay).
