CREATE TABLE IF NOT EXISTS "plan_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"organization_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"plan" text NOT NULL,
	"billing_cycle" text NOT NULL,
	"notes" text,
	"status" text DEFAULT 'requested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plan_requests" ADD CONSTRAINT "plan_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plan_requests_status_created_idx" ON "plan_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plan_requests_email_idx" ON "plan_requests" USING btree ("email");