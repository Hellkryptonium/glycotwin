# Doctor Dashboard

The doctor dashboard is the browser application for doctor authentication, patient lookup, invitations, and connected-patient visibility.

## Architecture

This is a Next.js pages-router application written in TypeScript. Axios provides the API client, TanStack Query manages server state, and Zustand stores the access/refresh session on the client. The dashboard calls the Express API and does not access PostgreSQL directly.

## Configuration

Create `.env.local` from `.env.example`:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
```

Only the API base URL belongs in this client-side environment file. Do not put secrets in `NEXT_PUBLIC_*` variables.

## Development and production

```powershell
npm install
npm run dev
npm run typecheck
npm run build
npm run start
```

## Implemented routes and features

- `/auth/register` — doctor registration.
- `/auth/login` — doctor/patient login routing.
- `/dashboard` — authenticated overview.
- `/patients` — exact-email patient search, invitation creation, and connected patients.
- `/patients/[patientId]` — read-only profile and paginated blood-glucose history for an actively connected patient.
- `/settings` — account information and logout.

Doctor invitation creation, connected-patient listing, profile reads, and glucose history require the API's verified-doctor authorization policy. The dashboard displays incomplete fields explicitly, supports date/context filters, handles API errors, and does not provide profile or glucose editing.
