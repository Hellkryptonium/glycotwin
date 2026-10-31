ALTER TABLE "doctor_profiles" DROP CONSTRAINT "doctor_profiles_years_of_experience_check";--> statement-breakpoint
ALTER TABLE "doctor_profiles" ALTER COLUMN "full_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "doctor_profiles" ALTER COLUMN "medical_registration_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "doctor_profiles" ALTER COLUMN "medical_council" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "doctor_profiles" ALTER COLUMN "specialization" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "doctor_profiles" ALTER COLUMN "hospital_or_clinic" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "doctor_profiles" ALTER COLUMN "years_of_experience" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "patient_profiles" ALTER COLUMN "full_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "doctor_profiles" ADD CONSTRAINT "doctor_profiles_years_of_experience_check" CHECK ("doctor_profiles"."years_of_experience" IS NULL OR "doctor_profiles"."years_of_experience" >= 0);