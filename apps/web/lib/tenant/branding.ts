import type { TenantBranding } from './types';

/** CSS custom-property overrides for one tenant's branding, rendered inline per-request so no
 * tenant's colors are ever baked into a shared static build (see architecture plan §4). */
export function brandingStyleTag(branding: TenantBranding): string {
  const c = branding.colors || {};
  const vars = [
    c.primary && `--brand-primary: ${c.primary};`,
    c.primaryForeground && `--brand-primary-foreground: ${c.primaryForeground};`,
    c.accent && `--brand-accent: ${c.accent};`,
  ]
    .filter(Boolean)
    .join(' ');
  return vars ? `:root { ${vars} }` : '';
}
