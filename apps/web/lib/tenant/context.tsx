'use client';

import { createContext, useContext } from 'react';
import type { TenantLookup } from './types';

const TenantContext = createContext<TenantLookup | null>(null);

export function TenantProvider({ tenant, children }: { tenant: TenantLookup; children: React.ReactNode }) {
  return <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>;
}

/** Throws if used outside a (tenant) route — every page under it is expected to have a tenant. */
export function useTenant(): TenantLookup {
  const tenant = useContext(TenantContext);
  if (!tenant) throw new Error('useTenant() called outside a tenant route');
  return tenant;
}
