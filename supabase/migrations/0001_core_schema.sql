CREATE TABLE "modules" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"min_plan_tier" text,
	"is_beta" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "modules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"stripe_price_id" text,
	"included_modules" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tenant_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
ALTER TABLE "tenant_domains" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tenant_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_memberships_tenant_user_unique" UNIQUE("tenant_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "tenant_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tenant_modules" (
	"tenant_id" uuid NOT NULL,
	"module_key" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled_at" timestamp with time zone,
	"enabled_by" uuid,
	CONSTRAINT "tenant_modules_tenant_id_module_key_pk" PRIMARY KEY("tenant_id","module_key")
);
--> statement-breakpoint
ALTER TABLE "tenant_modules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'trialing' NOT NULL,
	"plan_id" uuid,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"branding" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tenants_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant_domains" ADD CONSTRAINT "tenant_domains_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_modules" ADD CONSTRAINT "tenant_modules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_modules" ADD CONSTRAINT "tenant_modules_module_key_modules_key_fk" FOREIGN KEY ("module_key") REFERENCES "public"."modules"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_modules" ADD CONSTRAINT "tenant_modules_enabled_by_users_id_fk" FOREIGN KEY ("enabled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "modules_public_read" ON "modules" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "plans_public_read" ON "plans" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "tenant_domains" AS PERMISSIVE FOR ALL TO public USING ("tenant_domains"."tenant_id" in (select current_tenant_ids())) WITH CHECK ("tenant_domains"."tenant_id" in (select current_tenant_ids()));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "tenant_memberships" AS PERMISSIVE FOR ALL TO public USING ("tenant_memberships"."tenant_id" in (select current_tenant_ids())) WITH CHECK ("tenant_memberships"."tenant_id" in (select current_tenant_ids()));--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "tenant_modules" AS PERMISSIVE FOR ALL TO public USING ("tenant_modules"."tenant_id" in (select current_tenant_ids())) WITH CHECK ("tenant_modules"."tenant_id" in (select current_tenant_ids()));--> statement-breakpoint
CREATE POLICY "tenants_member_read" ON "tenants" AS PERMISSIVE FOR SELECT TO public USING ("tenants"."id" in (select current_tenant_ids()));--> statement-breakpoint
CREATE POLICY "users_self_read" ON "users" AS PERMISSIVE FOR SELECT TO public USING ("users"."id" = auth.uid());