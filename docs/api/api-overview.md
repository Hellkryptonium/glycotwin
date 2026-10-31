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

All connection routes are authenticated. Doctor operations require a verified doctor; patient operations require an active patient account. The authoritative schemas and response types are in `apps/api/src/modules/auth` and `apps/api/src/modules/connections`.
