CREATE TABLE "medication_doses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"medication_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"taken_at" timestamp with time zone,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "medication_doses_status_check" CHECK ("medication_doses"."status" IN ('taken', 'skipped', 'missed'))
);
--> statement-breakpoint
CREATE TABLE "medications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"dosage" varchar(200) NOT NULL,
	"frequency" varchar(100) NOT NULL,
	"schedule_times" text[] NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"instructions" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"discontinued_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "medications_status_check" CHECK ("medications"."status" IN ('active', 'discontinued')),
	CONSTRAINT "medications_dates_check" CHECK ("medications"."end_date" IS NULL OR "medications"."end_date" >= "medications"."start_date")
);
--> statement-breakpoint
ALTER TABLE "medication_doses" ADD CONSTRAINT "medication_doses_medication_id_medications_id_fk" FOREIGN KEY ("medication_id") REFERENCES "public"."medications"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "medication_doses" ADD CONSTRAINT "medication_doses_patient_id_patient_profiles_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient_profiles"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_patient_id_patient_profiles_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient_profiles"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "medication_doses_medication_scheduled_idx" ON "medication_doses" USING btree ("medication_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "medication_doses_patient_scheduled_idx" ON "medication_doses" USING btree ("patient_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "medications_patient_idx" ON "medications" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "medications_patient_status_idx" ON "medications" USING btree ("patient_id","status");