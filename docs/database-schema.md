# GlycoTwin Database Schema

The initial PostgreSQL schema is defined in `apps/api/src/db/schema`. Drizzle Kit migrations are generated in `apps/api/drizzle`.

## Entities

- `users` stores account identity, role, activation state, email verification time, and password hashes. Raw passwords are never part of this schema.
- `doctor_profiles` stores professional profile data. `verification_status` defaults to `pending`; a registration number does not verify a doctor.
- `patient_profiles` stores only the requested patient profile fields. Date of birth, gender, and diabetes type are optional.
- `doctor_patient_invitations` records a doctor's request to establish a patient relationship and its consent response.
- `doctor_patient_relationships` records access relationships created from accepted invitations. Active and revoked relationships are retained for auditability.
- `glucose_readings` stores patient-owned manual blood glucose records with a PostgreSQL `numeric` value, original unit, measurement context, measured timestamp, notes, and audit timestamps.
- `refresh_tokens` stores only a unique hash and lifecycle timestamps. Raw refresh tokens must never be persisted.
- `audit_logs` stores actor, action, resource, JSON metadata, and creation time. Metadata must exclude passwords, tokens, and unnecessary health information.

All generated timestamps use PostgreSQL `timestamp with time zone`. UUID primary keys use PostgreSQL's `gen_random_uuid()` default.

## Relationships and deletion behavior

- Each doctor or patient profile references exactly one user, and each user can have at most one profile of each type.
- Invitations reference doctor and patient profiles.
- Relationships reference doctor and patient profiles and the accepted invitation that created them.
- Refresh tokens reference users.
- Audit actors reference users with `ON DELETE SET NULL` so audit history survives account retention actions.
- Profile, invitation, relationship, and refresh-token references use `ON DELETE RESTRICT`. Sensitive patient records are not deleted transitively by this schema.

## Constraints and indexes

- User email, profile user IDs, refresh-token hashes, and relationship invitation IDs are unique.
- A partial unique index prevents more than one `pending` invitation for a doctor-patient pair.
- A partial unique index prevents more than one `active` relationship for a doctor-patient pair. Revoked history remains available.
- Status, actor, resource, patient, doctor, user, and timestamp indexes support common lookup paths.
- Glucose readings are indexed by patient and measured timestamp, and by patient and context.
- Doctor experience cannot be negative.
- Relationship status must agree with `revoked_at`: active relationships have no revocation timestamp, and revoked relationships must have one.
- Database triggers require doctor profiles to belong to doctor-role users and patient profiles to belong to patient-role users. They also prevent changing a user's role away from an existing profile type.
- A relationship trigger requires a matching invitation in `accepted` status. It also checks that the invitation's doctor and patient match the relationship. An accepted invitation with a relationship cannot later be changed to another status.

## Consent workflow

1. A doctor profile is created with `verification_status = 'pending'`.
2. Application logic permits invitations only according to the product's doctor-verification policy; a submitted registration number alone is not sufficient.
3. A pending invitation is created for one doctor-patient pair. The partial unique index prevents another pending invitation for that pair.
4. The patient accepts or declines the invitation. A pending invitation does not grant data access.
5. Only an accepted invitation can create a relationship. The migration trigger enforces the invitation status and pair match.
6. Access queries must require `doctor_patient_relationships.status = 'active'`. Revocation sets `status = 'revoked'` and `revoked_at`; the partial unique index permits a later relationship after a new accepted invitation.

## Application-level invariants

Some rules depend on authorization or transaction context and are intentionally not encoded as simple column constraints:

- Only an authenticated, verified doctor should be allowed to send invitations. The schema stores verification state but does not implement authentication or authorization.
- Invitation acceptance, relationship creation, and consent timestamps should be performed in one transaction. The database trigger protects the final relationship row but does not define the surrounding API workflow.
- Every access query must filter for an active relationship. The schema does not use row-level security yet.
- `updated_at` values must be maintained by application update statements until update triggers are introduced.
- Audit metadata is application-controlled JSON. Services must redact credentials, tokens, and unnecessary health information before inserting it.
- Glucose values are validated at the API boundary for reasonable positive bounds, while no diagnostic interpretation or threshold classification is stored.
- Profile role triggers prevent incompatible role/profile combinations, but they do not enforce exactly one profile type for every user or require a profile for every non-admin user.

## Migrations

From `apps/api`:

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
```

The initial migration was generated with Drizzle Kit and reviewed manually for the PostgreSQL trigger constraints in the follow-up migration. Do not run `db:migrate` against production until the migration has been reviewed and approved. No migration was applied by this task, and no existing database data was deleted or reset.
