CREATE TABLE "patient_ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_profile_id" uuid NOT NULL,
	"title" varchar(120) DEFAULT 'New conversation' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_ai_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"review_kind" varchar(16),
	"image_name" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patient_ai_conversations" ADD CONSTRAINT "patient_ai_conversations_patient_profile_id_patient_profiles_id_fk" FOREIGN KEY ("patient_profile_id") REFERENCES "public"."patient_profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "patient_ai_messages" ADD CONSTRAINT "patient_ai_messages_conversation_id_patient_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."patient_ai_conversations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "patient_ai_conversations_patient_updated_idx" ON "patient_ai_conversations" USING btree ("patient_profile_id","updated_at");
--> statement-breakpoint
CREATE INDEX "patient_ai_messages_conversation_created_idx" ON "patient_ai_messages" USING btree ("conversation_id","created_at");
