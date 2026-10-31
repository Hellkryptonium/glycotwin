CREATE TYPE "public"."glucose_context" AS ENUM('FASTING', 'BEFORE_MEAL', 'AFTER_MEAL', 'RANDOM');--> statement-breakpoint
CREATE TYPE "public"."glucose_source" AS ENUM('MANUAL');--> statement-breakpoint
CREATE TYPE "public"."glucose_unit" AS ENUM('mg/dL', 'mmol/L');--> statement-breakpoint
CREATE TABLE "glucose_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"value" numeric(10, 4) NOT NULL,
	"unit" "glucose_unit" NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"context" "glucose_context" NOT NULL,
	"source" "glucose_source" DEFAULT 'MANUAL' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "glucose_readings" ADD CONSTRAINT "glucose_readings_patient_id_patient_profiles_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient_profiles"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "glucose_readings_patient_measured_at_idx" ON "glucose_readings" USING btree ("patient_id","measured_at");--> statement-breakpoint
CREATE INDEX "glucose_readings_patient_context_idx" ON "glucose_readings" USING btree ("patient_id","context");