# GlycoTwin

GlycoTwin is a diabetes digital-twin platform for connecting patients with doctors. It currently focuses on secure account access and a consent-based doctor-patient connection workflow; it does not yet provide clinical recommendations, glucose monitoring, or validated predictions.

## Status

### Implemented and tested

- Doctor registration and login in the web dashboard.
- Patient registration and login in the native Android app.
- JWT access tokens and rotating opaque refresh tokens.
- Doctor patient search and invitation creation.
- Patient invitation listing, acceptance, and decline.
- Connected patient visibility in the doctor dashboard after consent.
- PostgreSQL schema and Drizzle migrations.

### Implemented but not fully end-to-end verified

- Android invitation refresh and connection UI against a live doctor-dashboard session.
- The separate ML research API and generated model artifacts.

### Planned

- Patient profile editing and richer relationship management.
- Health data and digital-twin views.
- Clinical data integrations and validated research workflows.

## Architecture

```text
GlycoTwin/
├── apps/
│   ├── api/                 Express + TypeScript API
│   ├── doctor_dashboard/    Next.js doctor web application
│   ├── ml-service/          FastAPI research service
│   └── patient_mobile/      Kotlin + Jetpack Compose Android app
├── docs/                    Architecture and development documentation
└── README.md
```

The doctor dashboard and patient app communicate with the Express API under `/api/v1`. The API uses PostgreSQL through Drizzle ORM. The ML service is a separate research application and is not part of the authenticated patient-care workflow.

## Technology stack

- **API:** Node.js, Express 5, TypeScript, Zod, JOSE, bcryptjs, Pino.
- **Database:** PostgreSQL with Drizzle ORM and Drizzle Kit migrations.
- **Doctor dashboard:** Next.js, React, TypeScript, TanStack Query, Axios, Zustand, Tailwind CSS.
- **Patient app:** Kotlin, Jetpack Compose, Material 3, Retrofit, Kotlin Coroutines/Flow, Android Keystore.
- **ML research:** Python, FastAPI, scikit-learn, XGBoost, pandas, NumPy, pytest.

## Getting started

### Prerequisites

- Node.js and npm.
- PostgreSQL.
- Android Studio and an Android emulator for the patient app.
- Python 3.11+ for the research service.

### API

```powershell
cd apps/api
npm install
Copy-Item .env.example .env
# Fill DATABASE_URL and JWT secrets in .env.
npm run db:migrate
npm run dev
```

The API listens on port `5000` by default. See [apps/api/README.md](apps/api/README.md).

### Doctor dashboard

```powershell
cd apps/doctor_dashboard
npm install
Copy-Item .env.example .env.local
npm run dev
```

The dashboard uses `NEXT_PUBLIC_API_BASE_URL`, defaulting to `http://localhost:5000/api/v1`.

### Patient Android app

Open `apps/patient_mobile` in Android Studio, start the API, select an emulator, and run the `app` configuration. Build and test from PowerShell:

```powershell
cd apps/patient_mobile
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:testDebugUnitTest
```

The debug API URL is configurable with `-PAPI_BASE_URL=...`. Android Emulator host routing normally uses `http://10.0.2.2:5000/api/v1/`; a host LAN address may be required on some Windows virtualization setups.

### ML research service

See [apps/ml-service/README.md](apps/ml-service/README.md). Its dataset and model artifacts are generated locally and are not required to run the core API/dashboard/mobile workflow.

## API

The API prefix is `/api/v1`. Authentication, connection routes, validation schemas, and response contracts are maintained in `apps/api/src/modules`. See [docs/api/api-overview.md](docs/api/api-overview.md) and [apps/api/README.md](apps/api/README.md).

## Security and medical disclaimer

Authentication uses short-lived signed access tokens and rotating opaque refresh tokens. Passwords are hashed; raw refresh tokens are not stored by the API, and the Android app protects session tokens with Android Keystore. Doctor-patient data access is created only after patient consent to an invitation.

Keep `.env` files, keys, credentials, and service-account files out of Git. The ML service is experimental research code. GlycoTwin is not a clinically validated medical device and must not be used for diagnosis, treatment, or medical decision-making.
