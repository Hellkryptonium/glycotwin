CREATE TYPE "public"."treatment_context" AS ENUM('INSULIN', 'NON_INSULIN', 'LIFESTYLE', 'UNKNOWN');--> statement-breakpoint
ALTER TYPE "public"."glucose_source" ADD VALUE 'CGM';--> statement-breakpoint
ALTER TYPE "public"."glucose_source" ADD VALUE 'REPLAY';--> statement-breakpoint
ALTER TYPE "public"."glucose_source" ADD VALUE 'HEALTH_CONNECT';--> statement-breakpoint
CREATE TABLE "device_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"external_id" uuid NOT NULL,
	"kind" varchar(20) NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"value" double precision,
	"activity_type" varchar(100),
	"source" varchar(20) NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_activity_kind_check" CHECK ("device_activity"."kind" IN ('steps', 'workout', 'heart_rate')),
	CONSTRAINT "device_activity_source_check" CHECK ("device_activity"."source" IN ('WATCH', 'REPLAY'))
);
--> statement-breakpoint
ALTER TABLE "glucose_readings" ADD COLUMN "external_id" varchar(255);--> statement-breakpoint
ALTER TABLE "glucose_readings" ADD COLUMN "device_origin" varchar(255);--> statement-breakpoint
ALTER TABLE "medication_doses" ADD COLUMN "actual_dose" varchar(200);--> statement-breakpoint
ALTER TABLE "patient_profiles" ADD COLUMN "treatment_context" "treatment_context";--> statement-breakpoint
ALTER TABLE "device_activity" ADD CONSTRAINT "device_activity_patient_id_patient_profiles_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient_profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "device_activity_external_identity_idx" ON "device_activity" USING btree ("patient_id","external_id");--> statement-breakpoint
CREATE INDEX "device_activity_patient_measured_at_idx" ON "device_activity" USING btree ("patient_id","measured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "glucose_readings_external_identity_idx" ON "glucose_readings" USING btree ("patient_id","source","external_id");--> statement-breakpoint
ALTER TABLE "medication_doses" ADD CONSTRAINT "medication_doses_actual_dose_check" CHECK ("medication_doses"."actual_dose" IS NULL OR ("medication_doses"."status" = 'taken' AND "medication_doses"."taken_at" IS NOT NULL));