CREATE TABLE "policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"department" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'needs_input' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"rule" text,
	"detail" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gaps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"owner" text,
	"source" text,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "policies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "policies" AS PERMISSIVE FOR ALL TO public USING ("policies"."tenant_id" in (select current_tenant_ids())) WITH CHECK ("policies"."tenant_id" in (select current_tenant_ids()));