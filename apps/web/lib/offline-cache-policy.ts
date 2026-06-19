/**
 * Offline read policy for BondFlow PWA support.
 *
 * Cache for offline reads:
 * - relationships
 * - milestones
 * - reputation summary
 * - memory timeline
 *
 * Never cache:
 * - auth/access tokens
 * - permissions/roles/platform-admin state
 * - feature flags
 * - transaction state
 */
export const OFFLINE_CACHEABLE_QUERY_PREFIXES = [
  'relationships',
  'memory',
  'reputation',
] as const;

export const OFFLINE_NEVER_CACHE_QUERY_PREFIXES = [
  'auth',
  'feature-flags',
  'notifications',
  'health',
] as const;
