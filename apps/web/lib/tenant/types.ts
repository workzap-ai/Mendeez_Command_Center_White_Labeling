export type TenantBranding = {
  displayName?: string;
  logoUrl?: string;
  faviconUrl?: string;
  colors?: {
    primary?: string;
    primaryForeground?: string;
    accent?: string;
    background?: string;
  };
  theme?: 'light' | 'dark';
};

export type TenantStatus = 'trialing' | 'active' | 'suspended' | 'cancelled';

// What a pre-auth request is allowed to know about a tenant — mirrors exactly the columns
// public.resolve_tenant_by_host() returns (supabase/migrations/0001_rls_support.sql). Never add a
// field here without adding it to that function first; this type is not itself a security
// boundary, the SQL function is.
export type TenantLookup = {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  branding: TenantBranding;
};
