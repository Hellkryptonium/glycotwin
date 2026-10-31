# Development guide

## Local services

Start PostgreSQL, then start the API from `apps/api` with `npm run dev`. Start the doctor dashboard from `apps/doctor_dashboard` with `npm run dev`. Run the Android app from Android Studio or Gradle after configuring the API base URL.

## Validation

```powershell
cd apps/api
npm run typecheck
npm test
npm run build

cd ../doctor_dashboard
npm run typecheck
npm run build

cd ../patient_mobile
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:testDebugUnitTest
```

Do not commit `.env` files, generated build outputs, datasets, model artifacts, APKs, or local databases. Keep migrations, lockfiles, Gradle wrappers, and sanitized `.env.example` files tracked.
