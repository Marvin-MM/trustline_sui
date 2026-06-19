/**
 * Typed route helpers.
 * All navigation in the app uses these functions — never raw string concatenation.
 */

import { buildWalrusBlobUrl } from '@/lib/walrus';

export const ROUTES = {
  // Public
  landing: () => '/' as const,
  auth: () => '/auth' as const,

  // Personal mode
  dashboard: () => '/dashboard' as const,
  personalRelationships: () => '/dashboard/relationships' as const,
  personalRelationshipDetail: (id: string) => `/dashboard/relationships/${id}` as const,
  personalReputation: () => '/dashboard/reputation' as const,

  // Tenant mode
  tenantDashboard: (slug: string) => `/${slug}` as const,
  tenantRelationships: (slug: string) => `/${slug}/relationships` as const,
  tenantNewRelationship: (slug: string) => `/${slug}/relationships/new` as const,
  tenantRelationshipDetail: (slug: string, id: string) => `/${slug}/relationships/${id}` as const,
  tenantDeliverable: (slug: string, id: string) => `/${slug}/deliverables/${id}` as const,
  tenantMemoryOverview: (slug: string) => `/${slug}/memory` as const,
  tenantMemory: (slug: string, relationshipId: string) => `/${slug}/memory/${relationshipId}` as const,
  tenantReputation: (slug: string) => `/${slug}/reputation` as const,
  tenantAnalytics: (slug: string) => `/${slug}/analytics` as const,

  // Settings
  tenantSettings: (slug: string) => `/${slug}/settings` as const,
  tenantSettingsMembers: (slug: string) => `/${slug}/settings/members` as const,
  tenantSettingsFeatureFlags: (slug: string) => `/${slug}/settings/feature-flags` as const,

  // Admin
  tenantAdmin: (slug: string) => `/${slug}/admin` as const,
  tenantAdminQueues: (slug: string) => `/${slug}/admin/queues` as const,
  tenantAdminTransactions: (slug: string) => `/${slug}/admin/transactions` as const,
  tenantAdminPrompts: (slug: string) => `/${slug}/admin/prompts` as const,

  // External
  suiExplorer: (digest: string) =>
    `${process.env['NEXT_PUBLIC_SUI_EXPLORER_URL'] ?? 'https://testnet.suivision.xyz'}/txblock/${digest}` as const,
  walrusBlob: (blobId: string) => buildWalrusBlobUrl(blobId),
} as const;
