import type { ModuleManifest } from '../types';

export const retailManifest: ModuleManifest = {
  key: 'retail',
  name: 'Retail / Outlets',
  description: 'Store locations and daily sales, per outlet',
  minPlanTier: 'pro',
  navEntries: [{ label: 'Retail', href: '/retail' }],
  routePrefixes: ['/retail'],
};
