// A module is a folder under modules/<key>/ plus one manifest registered in registry.ts. Nothing
// about tenant resolution, billing, or nav rendering needs to change to add a module — all of
// that machinery reads this generic shape. See modules/registry.ts for the registration point and
// modules/guard.ts for how tenant_modules.enabled actually gates access to what's declared here.
export type ModuleNavEntry = {
  label: string;
  href: string;
  icon?: string;
};

export type ModuleManifest = {
  key: string;
  name: string;
  description: string;
  minPlanTier?: string;
  navEntries: ModuleNavEntry[];
  /** Path prefixes this module owns, e.g. ['/finance'] — used by requireModule() route guards. */
  routePrefixes: string[];
};
