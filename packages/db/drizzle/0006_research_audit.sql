CREATE TABLE IF NOT EXISTS "reference_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"org_type" text NOT NULL,
	"cause" text,
	"region" text,
	"url" text NOT NULL,
	"retrieved_on" timestamp with time zone NOT NULL,
	"strengths" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "research_audits" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"site_url" text NOT NULL,
	"platform" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"seo_score" integer,
	"aio_score" integer,
	"uiux_score" integer,
	"brand_score" integer,
	"overall_score" integer,
	"layer_weights" jsonb,
	"pillar_weights" jsonb,
	"summary" jsonb,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	CONSTRAINT "research_audits_status_ck" CHECK ("research_audits"."status" in ('queued','running','in_review','released','failed'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "research_findings" (
	"id" text PRIMARY KEY NOT NULL,
	"audit_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"pillar" text NOT NULL,
	"layer" text NOT NULL,
	"check_id" text NOT NULL,
	"result" text NOT NULL,
	"evidence" text,
	"source_id" text,
	"source_url" text,
	"source_name" text,
	"fix" text,
	"effort" text,
	"points" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "research_findings_pillar_ck" CHECK ("research_findings"."pillar" in ('seo','aio','uiux','brand')),
	CONSTRAINT "research_findings_layer_ck" CHECK ("research_findings"."layer" in ('rules','reference','peer')),
	CONSTRAINT "research_findings_result_ck" CHECK ("research_findings"."result" in ('pass','fail','could_not_check')),
	CONSTRAINT "research_findings_source_ck" CHECK ("research_findings"."layer" = 'rules' or "research_findings"."source_url" is not null)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "review_edits" (
	"id" text PRIMARY KEY NOT NULL,
	"audit_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"target" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "research_audits" ADD CONSTRAINT "research_audits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "research_findings" ADD CONSTRAINT "research_findings_audit_id_research_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."research_audits"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "research_findings" ADD CONSTRAINT "research_findings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "research_findings" ADD CONSTRAINT "research_findings_source_id_reference_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."reference_sources"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_edits" ADD CONSTRAINT "review_edits_audit_id_research_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."research_audits"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_edits" ADD CONSTRAINT "review_edits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "research_audits_org_created_idx" ON "research_audits" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "research_findings_audit_idx" ON "research_findings" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "review_edits_audit_idx" ON "review_edits" USING btree ("audit_id");