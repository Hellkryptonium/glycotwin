# API overview

The Express API is served under `/api/v1`.

## Authentication

- `POST /auth/register/doctor`
- `POST /auth/register/patient`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

## Doctor connections

- `GET /doctor/patients/search?email=...`
- `POST /doctor/invitations`
- `GET /doctor/patients?page=1&limit=20`

## Patient connections

- `GET /patient/invitations`
- `POST /patient/invitations/:id/respond` with `{ "action": "accepted" }` or `{ "action": "declined" }`
- `POST /patient/relationships/:id/revoke`

## Profiles

- `GET /patient/profile` — authenticated patient profile and account email.
- `PUT /patient/profile` — authenticated patient creates or replaces the supported profile fields.
- `GET /doctor/patients/:patientId/profile` — verified doctor read access when an active relationship exists.

## Glucose records

- `POST /patient/glucose-readings`
- `GET /patient/glucose-readings?page=1&limit=20`
- `GET /patient/glucose-readings/:id`
- `PUT /patient/glucose-readings/:id`
- `DELETE /patient/glucose-readings/:id`
- `GET /doctor/patients/:patientId/glucose-readings?page=1&limit=20&from=...&to=...&context=...`

Patient writes accept a decimal `value`, `unit` (`mg/dL` or `mmol/L`), `measuredAt`, context (`FASTING`, `BEFORE_MEAL`, `AFTER_MEAL`, or `RANDOM`), and optional notes. Values are stored as PostgreSQL `numeric`; records are manual-source records in this milestone.

All connection and profile routes are authenticated. Doctor operations require a verified doctor; patient operations require an active patient account. The authoritative schemas and response types are in `apps/api/src/modules/auth`, `apps/api/src/modules/connections`, and `apps/api/src/modules/patients`.
