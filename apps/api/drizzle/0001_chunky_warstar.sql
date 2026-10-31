ALTER TABLE "doctor_profiles" ADD CONSTRAINT "doctor_profiles_years_of_experience_check" CHECK ("doctor_profiles"."years_of_experience" >= 0);--> statement-breakpoint
ALTER TABLE "doctor_patient_relationships" ADD CONSTRAINT "doctor_patient_relationships_revocation_consistency_check" CHECK (("doctor_patient_relationships"."status" = 'active' AND "doctor_patient_relationships"."revoked_at" IS NULL) OR ("doctor_patient_relationships"."status" = 'revoked' AND "doctor_patient_relationships"."revoked_at" IS NOT NULL));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_doctor_profile_role() RETURNS trigger AS $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND role = 'doctor'::user_role) THEN
		RAISE EXCEPTION 'doctor profile user must have doctor role';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER doctor_profile_role_trigger
BEFORE INSERT OR UPDATE OF user_id ON doctor_profiles
FOR EACH ROW EXECUTE FUNCTION enforce_doctor_profile_role();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_patient_profile_role() RETURNS trigger AS $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND role = 'patient'::user_role) THEN
		RAISE EXCEPTION 'patient profile user must have patient role';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER patient_profile_role_trigger
BEFORE INSERT OR UPDATE OF user_id ON patient_profiles
FOR EACH ROW EXECUTE FUNCTION enforce_patient_profile_role();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_user_role_profile_alignment() RETURNS trigger AS $$
BEGIN
	IF NEW.role <> 'doctor'::user_role AND EXISTS (SELECT 1 FROM doctor_profiles WHERE user_id = NEW.id) THEN
		RAISE EXCEPTION 'user with doctor profile must retain doctor role';
	END IF;
	IF NEW.role <> 'patient'::user_role AND EXISTS (SELECT 1 FROM patient_profiles WHERE user_id = NEW.id) THEN
		RAISE EXCEPTION 'user with patient profile must retain patient role';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER user_role_profile_alignment_trigger
BEFORE UPDATE OF role ON users
FOR EACH ROW EXECUTE FUNCTION enforce_user_role_profile_alignment();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_relationship_invitation() RETURNS trigger AS $$
DECLARE
	invitation_record RECORD;
BEGIN
	SELECT status, doctor_id, patient_id
	INTO invitation_record
	FROM doctor_patient_invitations
	WHERE id = NEW.invitation_id;

	IF invitation_record IS NULL
		 OR invitation_record.status <> 'accepted'::invitation_status
		 OR invitation_record.doctor_id <> NEW.doctor_id
		 OR invitation_record.patient_id <> NEW.patient_id THEN
		RAISE EXCEPTION 'relationship requires a matching accepted invitation';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER relationship_invitation_trigger
BEFORE INSERT OR UPDATE OF doctor_id, patient_id, invitation_id ON doctor_patient_relationships
FOR EACH ROW EXECUTE FUNCTION enforce_relationship_invitation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_accepted_invitation_regression() RETURNS trigger AS $$
BEGIN
	IF EXISTS (SELECT 1 FROM doctor_patient_relationships WHERE invitation_id = OLD.id)
		 AND (NEW.status <> 'accepted'::invitation_status
		 OR NEW.doctor_id <> OLD.doctor_id
		 OR NEW.patient_id <> OLD.patient_id) THEN
		RAISE EXCEPTION 'invitation with a relationship cannot change status or doctor-patient pair';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER accepted_invitation_regression_trigger
BEFORE UPDATE OF status, doctor_id, patient_id ON doctor_patient_invitations
FOR EACH ROW EXECUTE FUNCTION prevent_accepted_invitation_regression();