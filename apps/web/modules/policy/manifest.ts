import type { ModuleManifest } from '../types';

export const policyManifest: ModuleManifest = {
  key: 'policy',
  name: 'Policies & SOPs',
  description: 'One place for every rule the business runs on — seeded, filled, approved, amended',
  minPlanTier: 'starter',
  navEntries: [{ label: 'Policies', href: '/policy' }],
  routePrefixes: ['/policy'],
};
