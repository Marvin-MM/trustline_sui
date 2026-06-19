/**
 * Typed query key factory.
 * All query keys are defined here — never inline in components or hooks.
 * This makes invalidation predictable: invalidate by key prefix.
 */

export const queryKeys = {
  // Auth
  auth: {
    nonce: (address: string) => ['auth', 'nonce', address] as const,
    me: () => ['auth', 'me'] as const,
  },

  // Tenants
  tenants: {
    all: () => ['tenants'] as const,
    list: () => ['tenants', 'list'] as const,
    detail: (id: string) => ['tenants', 'detail', id] as const,
    members: (id: string) => ['tenants', 'members', id] as const,
    usage: (id: string, range: string) => ['tenants', 'usage', id, range] as const,
    invitations: () => ['tenants', 'invitations'] as const,
  },

  // Feature flags
  featureFlags: {
    all: () => ['feature-flags'] as const,
    byTenant: (tenantId: string | null) => ['feature-flags', 'tenant', tenantId] as const,
  },

  // Relationships
  relationships: {
    all: () => ['relationships'] as const,
    list: (tenantId: string | null, page: number) => ['relationships', 'list', tenantId, page] as const,
    assigned: (page: number) => ['relationships', 'assigned', page] as const,
    detail: (id: string) => ['relationships', 'detail', id] as const,
    milestones: (id: string) => ['relationships', 'milestones', id] as const,
  },

  // Deliverables
  deliverables: {
    byRelationship: (relationshipId: string) => ['deliverables', relationshipId] as const,
    detail: (id: string) => ['deliverables', 'detail', id] as const,
  },

  // Memory
  memory: {
    entries: (relationshipId: string, page: number) => ['memory', 'entries', relationshipId, page] as const,
    all: (relationshipId: string) => ['memory', 'all', relationshipId] as const,
  },

  // Reputation
  reputation: {
    profile: (walletAddress: string) => ['reputation', 'profile', walletAddress] as const,
    attestations: (walletAddress: string) => ['reputation', 'attestations', walletAddress] as const,
  },

  // Agent actions (AI activity)
  agentActions: {
    byRelationship: (relationshipId: string, page: number) =>
      ['agent-actions', relationshipId, page] as const,
    recent: (relationshipId: string) => ['agent-actions', 'recent', relationshipId] as const,
  },

  // Audit log
  auditLog: {
    byRelationship: (relationshipId: string, cursor: string | null) =>
      ['audit-log', relationshipId, cursor] as const,
  },

  // Notifications
  notifications: {
    list: () => ['notifications', 'list'] as const,
    unread: () => ['notifications', 'unread'] as const,
  },

  // Admin
  admin: {
    queues: () => ['admin', 'queues'] as const,
    dlq: () => ['admin', 'dlq'] as const,
    transactions: (page: number) => ['admin', 'transactions', page] as const,
    prompts: () => ['admin', 'prompts'] as const,
    promptDetail: (key: string) => ['admin', 'prompts', key] as const,
  },

  // Network health
  health: {
    backend: () => ['health', 'backend'] as const,
  },
} as const;
