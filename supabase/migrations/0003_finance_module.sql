CREATE TABLE "finance_cost_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"period_label" text,
	"raw_import" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance_cost_audit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "finance_gst_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"fiscal_year" integer NOT NULL,
	"fiscal_month" integer NOT NULL,
	"gst_type" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance_gst_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "finance_pl_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"fiscal_year" integer NOT NULL,
	"fiscal_month" integer NOT NULL,
	"line_item" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance_pl_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "finance_cost_audit" ADD CONSTRAINT "finance_cost_audit_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_gst_entries" ADD CONSTRAINT "finance_gst_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_pl_lines" ADD CONSTRAINT "finance_pl_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "finance_cost_audit" AS PERMISSIVE FOR ALL TO public USING ("finance_cost_audit"."tenant_id" in (select current_tenant_ids())) WITH CHECK ("finance_cost_audit"."tenant_id" in (select current_tenant_ids()));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "finance_gst_entries" AS PERMISSIVE FOR ALL TO public USING ("finance_gst_entries"."tenant_id" in (select current_tenant_ids())) WITH CHECK ("finance_gst_entries"."tenant_id" in (select current_tenant_ids()));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "finance_pl_lines" AS PERMISSIVE FOR ALL TO public USING ("finance_pl_lines"."tenant_id" in (select current_tenant_ids())) WITH CHECK ("finance_pl_lines"."tenant_id" in (select current_tenant_ids()));