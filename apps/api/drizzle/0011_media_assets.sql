CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"purpose" varchar(40) NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"object_key" varchar(600) NOT NULL,
	"content_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"original_file_name" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "doctor_profiles" ADD COLUMN "profile_photo_asset_id" uuid;
--> statement-breakpoint
ALTER TABLE "patient_profiles" ADD COLUMN "profile_photo_asset_id" uuid;
--> statement-breakpoint
CREATE INDEX "media_assets_owner_created_idx" ON "media_assets" USING btree ("owner_user_id","created_at");
--> statement-breakpoint
CREATE INDEX "media_assets_status_idx" ON "media_assets" USING btree ("status");
