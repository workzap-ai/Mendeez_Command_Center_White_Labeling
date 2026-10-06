CREATE TABLE "retail_daily_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"sale_date" date NOT NULL,
	"net_sales" numeric(18, 2) NOT NULL,
	"transactions" integer DEFAULT 0 NOT NULL,
	"footfall" integer,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retail_daily_sales_outlet_date_unique" UNIQUE("outlet_id","sale_date")
);
--> statement-breakpoint
ALTER TABLE "retail_daily_sales" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "retail_outlets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"manager_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "retail_outlets_tenant_code_unique" UNIQUE("tenant_id","code")
);
--> statement-breakpoint
ALTER TABLE "retail_outlets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "retail_daily_sales" ADD CONSTRAINT "retail_daily_sales_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retail_daily_sales" ADD CONSTRAINT "retail_daily_sales_outlet_id_retail_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."retail_outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retail_outlets" ADD CONSTRAINT "retail_outlets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "retail_daily_sales" AS PERMISSIVE FOR ALL TO public USING ("retail_daily_sales"."tenant_id" in (select current_tenant_ids())) WITH CHECK ("retail_daily_sales"."tenant_id" in (select current_tenant_ids()));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "retail_outlets" AS PERMISSIVE FOR ALL TO public USING ("retail_outlets"."tenant_id" in (select current_tenant_ids())) WITH CHECK ("retail_outlets"."tenant_id" in (select current_tenant_ids()));