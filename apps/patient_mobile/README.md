# Patient Mobile App

Native Android patient application for account access and consent-based doctor connections.

## Stack and setup

- Kotlin and Jetpack Compose with Material 3.
- Package: `com.glycotwin.patient`.
- Minimum Android SDK: 26.
- Android Studio with an Android Emulator.
- Retrofit/Gson for HTTP, Coroutines/StateFlow for state, Android Keystore for session tokens.

Open `apps/patient_mobile`In the GlycoTwin Android application, add a **Delete Account** option to the existing Profile screen (`ProfileScreen.kt`).

### 1. UI design
- Add a "Delete account" button directly below the existing "Log out" button.
- Use the same width, rounded corners, and overall dimensions as the Log out button.
- Use a white or transparent background matching the existing screen design.
- Use a subtle red border and red text.
- Add a trash/delete icon before the text.
- Do not change the existing Account card, Your Information card, Edit Profile button, or Log out button.
- Preserve the existing GlycoTwin typography, spacing, background, and bottom navigation.

### 2. Delete confirmation dialog
When the user taps Delete account, display a confirmation dialog:

**Title:** Delete your account?

**Message:** Are you sure you want to permanently delete your GlycoTwin account? This action cannot be undone. Your personal information, health records, glucose readings, medications, and lifestyle entries associated with your account will also be deleted.

Provide two buttons:
- Cancel – closes the dialog without making changes.
- Delete permanently – proceeds with account deletion.

### 3. Backend functionality
Implement actual account deletion, not just UI removal.

- Authenticate or re-authenticate the user before deletion when required.
- Delete the user's account from the authentication provider.
- Delete all associated user data from the backend database, including health records, glucose readings, medications, lifestyle entries, and profile information.
- Ensure deletion is scoped strictly to the currently authenticated user.
- Handle database cleanup and authentication deletion safely.
- Prevent partial deletion from leaving orphaned personal health data.
- Navigate to the login/welcome screen after successful deletion.
- Display a clear error message if deletion fails.

### 4. Important requirements
- First inspect the existing `ProfileScreen.kt`, `PatientViewModel.kt`, authentication implementation, API services, and backend database structure.
- Reuse the existing architecture, components, API patterns, and navigation.
- Do not introduce duplicate functions or unnecessary dependencies.
- Do not break login, registration, profile editing, logout, or existing navigation.
- Do not hardcode user IDs.
- Do not claim an account has been deleted unless the backend confirms success.

### 5. Final verification
Test the following:
1. Delete Account button appears below Log out.
2. Cancel keeps the account intact.
3. Confirmation triggers actual backend deletion.
4. Associated health and personal data are deleted.
5. Successful deletion redirects to the login screen.
6. Failed deletion displays an appropriate error.
7. Other users' accounts and data remain unaffected.

**Important:** Implement the complete feature end-to-end while preserving the existing GlycoTwin UI and functionality. Do not redesign the Profile screen. in Android Studio and run the `app` configuration after starting the API. PowerShell commands:

```powershell
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:testDebugUnitTest
```

The API URL is a Gradle build property:

```powershell
.\gradlew.bat :app:assembleDebug "-PAPI_BASE_URL=http://10.0.2.2:5050/api/v1/"
```

`10.0.2.2` is the Android Emulator alias for the Windows host. If the Windows emulator networking layer does not route that address, use the host's reachable LAN address instead. Debug builds allow cleartext HTTP; production builds do not.

## Integrated workflow

- Patient registration and login.
- Session restore, refresh, and logout.
- Profile completion after login, profile retrieval, and patient-owned profile updates.
- Editable full name, date of birth, gender, and diabetes type; email is read-only.
- Health Records tab with manual glucose entry, native date/time pickers, history, editing, deletion confirmation, and refresh.
- `GET /patient/invitations`.
- Accept/decline through `POST /patient/invitations/:id/respond`.
- Care Team invitation loading, refresh, action states, and errors.
- Dashboard pending-invitation count and accepted-invitation connection status.

## Limitations

The API currently has no patient-side relationship-list endpoint. The app therefore does not invent one; connected-doctor information is shown only when supported by returned accepted-invitation data. Gender and diabetes type remain validated text fields because the existing database has no enum values. Health metrics, device data, recommendations, and ML predictions are intentionally not implemented.
The patient app includes a Trends tab with authenticated 7-day, 30-day, and 90-day descriptive glucose analytics, daily summaries, and loading/empty/error states. Values are calculated from recorded readings and are not medical recommendations.

Debug builds also expose a `Preview sample data` action on the Trends tab for checking the complete UI without database records. It is not included in release builds and never changes production analytics.
The Lifestyle tab records patient-entered meals, activity, sleep, and symptoms through the authenticated API and supports listing and deletion.
The Medication tab lets patients add and edit active medications, discontinue them, record taken or skipped doses, and review recorded dose history. It does not generate reminders, recommendations, or medication data.
