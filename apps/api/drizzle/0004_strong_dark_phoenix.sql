CREATE TABLE "lifestyle_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"meal_type" varchar(20),
	"description" text,
	"activity_type" varchar(100),
	"duration_minutes" integer,
	"sleep_duration_minutes" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lifestyle_entries_type_check" CHECK ("lifestyle_entries"."type" IN ('meal', 'activity', 'sleep', 'symptom')),
	CONSTRAINT "lifestyle_entries_duration_check" CHECK ("lifestyle_entries"."duration_minutes" IS NULL OR "lifestyle_entries"."duration_minutes" > 0),
	CONSTRAINT "lifestyle_entries_sleep_duration_check" CHECK ("lifestyle_entries"."sleep_duration_minutes" IS NULL OR "lifestyle_entries"."sleep_duration_minutes" > 0)
);
--> statement-breakpoint
ALTER TABLE "lifestyle_entries" ADD CONSTRAINT "lifestyle_entries_patient_id_patient_profiles_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient_profiles"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "lifestyle_entries_patient_occurred_at_idx" ON "lifestyle_entries" USING btree ("patient_id","occurred_at");--> statement-breakpoint
CREATE INDEX "lifestyle_entries_patient_type_idx" ON "lifestyle_entries" USING btree ("patient_id","type");