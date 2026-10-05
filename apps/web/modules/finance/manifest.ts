import type { ModuleManifest } from '../types';

export const financeManifest: ModuleManifest = {
  key: 'finance',
  name: 'Finance',
  description: 'P&L, GST reporting, cost audit',
  minPlanTier: 'starter',
  navEntries: [{ label: 'P&L', href: '/finance/pl' }],
  routePrefixes: ['/finance'],
};
