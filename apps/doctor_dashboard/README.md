# Doctor Dashboard

The clinician workspace supports secure account access, patient invitations, connected health records, care notes, shared goals, and visit review.

## Local configuration

Copy `.env.example` to `.env.local` when you need to override the default API target.

```text
API_PROXY_TARGET=http://127.0.0.1:5050/api/v1
```

The browser sends API requests to the dashboard’s same-origin `/backend` route. Next.js forwards them to Express. Use the exact dashboard address configured as `FRONTEND_ORIGIN` in the API, typically `http://localhost:3000`. The legacy `NEXT_PUBLIC_API_BASE_URL` variable is also accepted as the proxy target. Set `NEXT_PUBLIC_PATIENT_APK_URL` when a reviewed Android release is ready to link on the landing page.

The dashboard retains a short-lived access token in memory. The backend sets a browser-only `HttpOnly` refresh cookie for the seven-day account session. Temporary connectivity errors offer a retry from protected pages. Apply the current API migrations before testing account and care features.

## Vercel deployment

Import the repository into Vercel, choose the Next.js preset, and set the Root Directory to `apps/doctor_dashboard`. Keep the preset's build and output settings. In Production, set `API_PROXY_TARGET=https://api.glycotwin.me/api/v1`. Configure a Preview value targeting the intended staging API if using preview deployments. Redeploy after changing the proxy target because Next.js generates the rewrite during the build.

On Render, set `FRONTEND_ORIGIN` to the exact HTTPS origin clinicians open in their browser. Neon credentials, JWT secrets, and doctor signup settings belong on Render. After deploying, visit `/backend/health` on the dashboard domain, sign in with a synthetic clinician account, then reload a protected page to confirm the refresh cookie works through the proxy.

## Workflows

- `/` offers separate entry points for clinicians and patients.
- `/auth/register` starts a session and opens the clinician profile form. `/auth/login` can restore an existing session or accept credentials.
- `/settings` supports clinician profile edits, displays the sign-in email, and lets clinicians change their password, sign out, or confirm account deletion.
- `/dashboard` shows an authenticated overview. `/patients` supports lookup and invitations for verified clinicians.
- `/patients/[patientId]` shows the patient profile, health timeline, trends, medication history, and care workspace for an active relationship. Patient-shared briefs link to individual timeline records.

## Commands

```powershell
npm install
npm run typecheck
npm run build
npm run dev
npm run start
```
