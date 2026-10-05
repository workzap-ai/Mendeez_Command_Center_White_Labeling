// The module system's single registration point. Adding a future module (Retail, E-commerce, ...)
// is this same pattern every time: a modules/<key>/ folder, a manifest, a schema file, and one
// line here — nothing about tenant resolution, billing, or nav rendering needs to change.
import type { ModuleManifest } from './types';
import { financeManifest } from './finance/manifest';

export const MODULE_REGISTRY: Record<string, ModuleManifest> = {
  finance: financeManifest,
};

export function getModuleForPath(pathname: string): ModuleManifest | null {
  for (const mod of Object.values(MODULE_REGISTRY)) {
    if (mod.routePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      return mod;
    }
  }
  return null;
}
