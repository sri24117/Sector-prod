CREATE TABLE IF NOT EXISTS "calendar_items" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"content_asset_id" text NOT NULL,
	"date" text NOT NULL,
	"channel" text NOT NULL,
	"objective" text NOT NULL,
	"assignee" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_assets" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "content_assets" ADD COLUMN "facts" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_items" ADD CONSTRAINT "calendar_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_items" ADD CONSTRAINT "calendar_items_content_asset_id_content_assets_id_fk" FOREIGN KEY ("content_asset_id") REFERENCES "public"."content_assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_org_date_idx" ON "calendar_items" USING btree ("organization_id","date");