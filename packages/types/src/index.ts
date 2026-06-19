import { z } from 'zod';

// ============================================================
// Permission Enum
// ============================================================

/**
 * Fine-grained permission definitions for the RBAC system.
 * Every route declares which permission(s) it requires.
 * Roles map to sets of permissions via ROLE_PERMISSIONS.
 */
export enum Permission {
  RELATIONSHIP_CREATE = 'RELATIONSHIP_CREATE',
  RELATIONSHIP_READ = 'RELATIONSHIP_READ',
  RELATIONSHIP_CANCEL = 'RELATIONSHIP_CANCEL',
  MILESTONE_RELEASE = 'MILESTONE_RELEASE',
  MILESTONE_DISPUTE_RAISE = 'MILESTONE_DISPUTE_RAISE',
  MILESTONE_DISPUTE_RESOLVE = 'MILESTONE_DISPUTE_RESOLVE',
  DELIVERABLE_UPLOAD = 'DELIVERABLE_UPLOAD',
  DELIVERABLE_VERIFY = 'DELIVERABLE_VERIFY',
  MEMORY_READ = 'MEMORY_READ',
  MEMORY_WRITE = 'MEMORY_WRITE',
  REPUTATION_GENERATE = 'REPUTATION_GENERATE',
  REPUTATION_READ = 'REPUTATION_READ',
  AGENT_CAP_GRANT = 'AGENT_CAP_GRANT',
  AGENT_CAP_REVOKE = 'AGENT_CAP_REVOKE',
  TENANT_MANAGE = 'TENANT_MANAGE',
  TENANT_READ = 'TENANT_READ',
  FEATURE_FLAG_MANAGE = 'FEATURE_FLAG_MANAGE',
  USAGE_READ = 'USAGE_READ',
  ADMIN_PANEL = 'ADMIN_PANEL',
}

// ============================================================
// Tenant Role Enum
// ============================================================

/**
 * Tenant-scoped roles. A user can have different roles in different tenants.
 * Roles are NEVER global — only isPlatformAdmin on User is global.
 */
export enum TenantRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

// ============================================================
// Tenant Plan Enum
// ============================================================

export enum TenantPlan {
  FREE = 'FREE',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

// ============================================================
// Role-to-Permission Mapping
// ============================================================

/**
 * Static, compile-time-constant mapping of roles to their permission sets.
 * Not runtime-computed — this is the authoritative source for RBAC checks.
 */
const VIEWER_PERMISSIONS: ReadonlySet<Permission> = new Set([
  Permission.RELATIONSHIP_READ,
  Permission.REPUTATION_READ,
  Permission.TENANT_READ,
]);

const MEMBER_PERMISSIONS: ReadonlySet<Permission> = new Set([
  ...VIEWER_PERMISSIONS,
  Permission.RELATIONSHIP_CREATE,
  Permission.MILESTONE_RELEASE,
  Permission.MILESTONE_DISPUTE_RAISE,
  Permission.DELIVERABLE_UPLOAD,
  Permission.DELIVERABLE_VERIFY,
  Permission.MEMORY_READ,
  Permission.REPUTATION_GENERATE,
  Permission.AGENT_CAP_GRANT,
  Permission.AGENT_CAP_REVOKE,
]);

const ADMIN_PERMISSIONS: ReadonlySet<Permission> = new Set([
  ...MEMBER_PERMISSIONS,
  Permission.TENANT_MANAGE,
  Permission.FEATURE_FLAG_MANAGE,
  Permission.USAGE_READ,
  Permission.RELATIONSHIP_CANCEL,
  Permission.MILESTONE_DISPUTE_RESOLVE,
]);

const OWNER_PERMISSIONS: ReadonlySet<Permission> = new Set([
  ...ADMIN_PERMISSIONS,
  Permission.ADMIN_PANEL,
]);

export const ROLE_PERMISSIONS: Readonly<Record<TenantRole, ReadonlySet<Permission>>> = {
  [TenantRole.VIEWER]: VIEWER_PERMISSIONS,
  [TenantRole.MEMBER]: MEMBER_PERMISSIONS,
  [TenantRole.ADMIN]: ADMIN_PERMISSIONS,
  [TenantRole.OWNER]: OWNER_PERMISSIONS,
} as const;

/**
 * Personal mode permissions — equivalent to MEMBER but scoped to own wallet only.
 * Used when no X-Tenant-ID header is present.
 */
export const PERSONAL_MODE_PERMISSIONS: ReadonlySet<Permission> = MEMBER_PERMISSIONS;

// ============================================================
// Relationship Status Enums
// ============================================================

export enum RelationshipStatus {
  PENDING_ON_CHAIN = 'PENDING_ON_CHAIN',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED_ON_CHAIN = 'FAILED_ON_CHAIN',
}

export enum MilestoneStatus {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  CONDITION_MET = 'CONDITION_MET',
  RELEASED = 'RELEASED',
  CANCELLED = 'CANCELLED',
  DISPUTED = 'DISPUTED',
}

export enum ReleasePolicy {
  PAYER_APPROVAL = 'PAYER_APPROVAL',
  AUTO_AFTER_CHALLENGE = 'AUTO_AFTER_CHALLENGE',
}

export enum DeliverableVerificationStatus {
  UPLOADED = 'UPLOADED',
  SCANNING = 'SCANNING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
}

export enum RelationshipActorRole {
  PAYER = 'PAYER',
  RECIPIENT = 'RECIPIENT',
  OPERATOR = 'OPERATOR',
  VIEWER = 'VIEWER',
}

export enum RelationshipAction {
  APPROVE_RELEASE = 'APPROVE_RELEASE',
  AUTO_RELEASE_PENDING = 'AUTO_RELEASE_PENDING',
  SUBMIT_DELIVERABLE = 'SUBMIT_DELIVERABLE',
  RAISE_DISPUTE = 'RAISE_DISPUTE',
  CANCEL_MILESTONE = 'CANCEL_MILESTONE',
  CANCEL_REMAINING = 'CANCEL_REMAINING',
  MANAGE_AUTOMATION = 'MANAGE_AUTOMATION',
  MANAGE_OPERATORS = 'MANAGE_OPERATORS',
  RESOLVE_DISPUTE = 'RESOLVE_DISPUTE',
}

export enum ConditionType {
  MANUAL = 'MANUAL',
  TIME_GATED = 'TIME_GATED',
  DELIVERABLE = 'DELIVERABLE',
}

export enum DisputeStatus {
  NONE = 'NONE',
  OPEN = 'OPEN',
  RESOLVED_RECIPIENT = 'RESOLVED_RECIPIENT',
  RESOLVED_PAYER = 'RESOLVED_PAYER',
}

// ============================================================
// Transaction Types
// ============================================================

export enum TransactionType {
  CREATE_RELATIONSHIP = 'CREATE_RELATIONSHIP',
  GRANT_AGENT_CAP = 'GRANT_AGENT_CAP',
  REVOKE_AGENT_CAP = 'REVOKE_AGENT_CAP',
  REGISTER_DELIVERABLE = 'REGISTER_DELIVERABLE',
  RELEASE_MILESTONE = 'RELEASE_MILESTONE',
  CANCEL_RELATIONSHIP = 'CANCEL_RELATIONSHIP',
  CANCEL_MILESTONE = 'CANCEL_MILESTONE',
  RAISE_DISPUTE = 'RAISE_DISPUTE',
  RESOLVE_DISPUTE = 'RESOLVE_DISPUTE',
  MINT_ATTESTATION = 'MINT_ATTESTATION',
  MINT_REPUTATION_PROOF = 'MINT_REPUTATION_PROOF',
  UPDATE_REPUTATION_PROOF = 'UPDATE_REPUTATION_PROOF',
  SUBMIT_DELIVERABLE = 'SUBMIT_DELIVERABLE',
  VERIFY_DELIVERABLE = 'VERIFY_DELIVERABLE',
  REJECT_DELIVERABLE = 'REJECT_DELIVERABLE',
  GRANT_OPERATOR_CAP = 'GRANT_OPERATOR_CAP',
  REVOKE_CAP = 'REVOKE_CAP',
  AUTO_RELEASE_MILESTONE = 'AUTO_RELEASE_MILESTONE',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

// ============================================================
// Agent Action Types
// ============================================================

export enum AgentActionType {
  ANOMALY_DETECTED = 'ANOMALY_DETECTED',
  PATTERN_RECOGNIZED = 'PATTERN_RECOGNIZED',
  DELIVERABLE_VERIFIED = 'DELIVERABLE_VERIFIED',
  DUPLICATE_PREVENTED = 'DUPLICATE_PREVENTED',
  CONDITION_REGISTERED = 'CONDITION_REGISTERED',
  MILESTONE_RELEASED = 'MILESTONE_RELEASED',
  MEMORY_WRITTEN = 'MEMORY_WRITTEN',
  MEMORY_INSIGHT_GENERATED = 'MEMORY_INSIGHT_GENERATED',
  CONTENT_SCANNED = 'CONTENT_SCANNED',
  REPUTATION_BUILT = 'REPUTATION_BUILT',
  ATTESTATION_MINTED = 'ATTESTATION_MINTED',
}

// ============================================================
// Notification Types
// ============================================================

export enum NotificationType {
  RELATIONSHIP_CREATED = 'RELATIONSHIP_CREATED',
  MILESTONE_CONDITION_MET = 'MILESTONE_CONDITION_MET',
  MILESTONE_RELEASED = 'MILESTONE_RELEASED',
  DISPUTE_RAISED = 'DISPUTE_RAISED',
  DISPUTE_RESOLVED = 'DISPUTE_RESOLVED',
  ANOMALY_FLAGGED = 'ANOMALY_FLAGGED',
  REPUTATION_PROOF_MINTED = 'REPUTATION_PROOF_MINTED',
  TEAM_MEMBER_INVITED = 'TEAM_MEMBER_INVITED',
  TEAM_MEMBER_JOINED = 'TEAM_MEMBER_JOINED',
}

export enum EmailProvider {
  RESEND = 'RESEND',
  NODEMAILER = 'NODEMAILER',
}

// ============================================================
// Resource Types (Usage Tracking)
// ============================================================

export enum ResourceType {
  CLAUDE_TOKENS = 'CLAUDE_TOKENS',
  GEMINI_TOKENS = 'GEMINI_TOKENS',
  WALRUS_BYTES = 'WALRUS_BYTES',
  SUI_GAS = 'SUI_GAS',
}

// ============================================================
// Scan Status
// ============================================================

export enum ScanStatus {
  PENDING = 'PENDING',
  CLEAN = 'CLEAN',
  SUSPICIOUS = 'SUSPICIOUS',
}

// ============================================================
// Feature Flag Keys
// ============================================================

export const FEATURE_FLAG_KEYS = {
  ENABLE_AUTO_RELEASE: 'ENABLE_AUTO_RELEASE',
  ENABLE_AI_VERIFICATION: 'ENABLE_AI_VERIFICATION',
  ENABLE_REPUTATION_PROOF: 'ENABLE_REPUTATION_PROOF',
  ENABLE_DISPUTE_RESOLUTION: 'ENABLE_DISPUTE_RESOLUTION',
  REQUIRE_DELIVERABLE_VERIFICATION: 'REQUIRE_DELIVERABLE_VERIFICATION',
} as const;

export type FeatureFlagKey = typeof FEATURE_FLAG_KEYS[keyof typeof FEATURE_FLAG_KEYS];

export const FEATURE_FLAG_CATALOG: Record<FeatureFlagKey, { label: string; description: string }> = {
  [FEATURE_FLAG_KEYS.ENABLE_AUTO_RELEASE]: {
    label: 'Auto-release automation',
    description: 'Allow opted-in milestones to release automatically after their challenge window.',
  },
  [FEATURE_FLAG_KEYS.ENABLE_AI_VERIFICATION]: {
    label: 'AI anomaly analysis and verification',
    description: 'Run AI anomaly checks during relationship creation and AI verification for deliverable evidence.',
  },
  [FEATURE_FLAG_KEYS.ENABLE_REPUTATION_PROOF]: {
    label: 'Reputation proofs',
    description: 'Allow recipients to mint and update on-chain reputation proofs from indexed attestations.',
  },
  [FEATURE_FLAG_KEYS.ENABLE_DISPUTE_RESOLUTION]: {
    label: 'Dispute resolution',
    description: 'Allow payer/operator dispute flows and admin dispute resolution for milestones.',
  },
  [FEATURE_FLAG_KEYS.REQUIRE_DELIVERABLE_VERIFICATION]: {
    label: 'Require deliverable verification',
    description: 'Require deliverable evidence to pass verification before payer approval can release funds.',
  },
};

// ============================================================
// Prompt Keys
// ============================================================

export const PROMPT_KEYS = {
  ANOMALY_DETECTION: 'anomaly-detection',
  PATTERN_RECOGNITION: 'pattern-recognition',
  DELIVERY_VERIFICATION: 'delivery-verification',
  DELIVERY_VERIFICATION_TOOL_CALLING: 'delivery-verification-tool-calling',
  MEMORY_WRITER: 'memory-writer',
  MEMORY_INSIGHT: 'memory-insight',
  REPUTATION_BUILDER: 'reputation-builder',
  CONTENT_SCAN: 'content-scan',
} as const;

export type PromptKey = typeof PROMPT_KEYS[keyof typeof PROMPT_KEYS];

// ============================================================
// Precision Policy
// ============================================================

/**
 * Precision policy used across BondFlow:
 * - Financial amounts and gas are stored as BigInt and serialized over HTTP as strings.
 * - Percentages are stored as basis points (10000 = 100%).
 * - AI confidence is an integer score from 0 to 100.
 * - Estimated provider costs are Decimal(18, 6) in the database.
 */
export const PRECISION_POLICY = {
  MONEY_WIRE_TYPE: 'string',
  GAS_WIRE_TYPE: 'string',
  PERCENTAGE_UNIT: 'basis_points',
  AI_CONFIDENCE_MIN: 0,
  AI_CONFIDENCE_MAX: 100,
  COST_DECIMAL_SCALE: 6,
} as const;

// ============================================================
// Zod Schemas — API Request/Response Validation
// ============================================================

/** Sui wallet address: 0x followed by 64 hex characters */
export const WalletAddressSchema = z.string().regex(
  /^0x[0-9a-fA-F]{64}$/,
  'Invalid Sui wallet address format. Must be 0x followed by 64 hex characters.'
);

/** Tenant slug: URL-safe identifier */
export const TenantSlugSchema = z.string()
  .min(2, 'Slug must be at least 2 characters')
  .max(50, 'Slug must be at most 50 characters')
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug must be URL-safe: lowercase letters, numbers, and hyphens only');

// --- Auth Schemas ---

export const NonceRequestSchema = z.object({
  walletAddress: WalletAddressSchema,
});

export const VerifySignatureSchema = z.object({
  walletAddress: WalletAddressSchema,
  signature: z.string().min(1, 'Signature is required'),
  message: z.string().min(1, 'Signed message is required'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().uuid('Invalid refresh token format'),
});

// --- Tenant Schemas ---

export const CreateTenantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: TenantSlugSchema,
});

export const UpdateTenantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

export const InviteMemberSchema = z.object({
  walletAddress: WalletAddressSchema,
  role: z.nativeEnum(TenantRole),
  email: z.string().email().optional(),
});

export const UpdateMemberRoleSchema = z.object({
  role: z.nativeEnum(TenantRole),
});

// --- Relationship Schemas ---

export const RelationshipMilestoneInputSchema = z.object({
  amount: z.string()
    .regex(/^(0|[1-9]\d*)(\.\d{1,6})?$/, 'Amount must be a positive USDC value with at most 6 decimals')
    .refine((value) => /[1-9]/.test(value), 'Amount must be greater than zero'),
  conditionType: z.nativeEnum(ConditionType),
  conditionValue: z.string().min(1, 'A milestone requirement is required').max(500),
  releasePolicy: z.nativeEnum(ReleasePolicy).default(ReleasePolicy.PAYER_APPROVAL),
}).superRefine((milestone, ctx) => {
  if (milestone.conditionType === ConditionType.MANUAL && milestone.releasePolicy !== ReleasePolicy.PAYER_APPROVAL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['releasePolicy'],
      message: 'Manual milestones require payer approval',
    });
  }
  if (milestone.conditionType === ConditionType.TIME_GATED) {
    const timestamp = /^\d+$/.test(milestone.conditionValue)
      ? Number(milestone.conditionValue)
      : new Date(milestone.conditionValue).getTime();
    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['conditionValue'],
        message: 'Time-gated milestones require a future timestamp',
      });
    }
  }
});

export const CreateRelationshipSchema = z.object({
  recipientWallet: WalletAddressSchema,
  milestones: z.array(RelationshipMilestoneInputSchema)
    .min(1, 'At least one milestone is required')
    .max(10, 'Maximum 10 milestones'),
  memo: z.string().max(64, 'Memo must be 64 characters or fewer'),
  tenantId: z.string().uuid().optional(),
});

export const GrantAgentCapSchema = z.object({
  agentAddress: WalletAddressSchema,
  expiryDurationSeconds: z.number().int().positive(),
  allowedActions: z.array(z.number().int().min(0).max(1)),
  maxActions: z.number().int().positive(),
});

export const GrantOperatorCapSchema = z.object({
  operatorAddress: WalletAddressSchema,
  expiryDurationSeconds: z.number().int().positive(),
  canRelease: z.boolean(),
  canCancel: z.boolean(),
  canDispute: z.boolean(),
});

export const RaiseDisputeSchema = z.object({
  reasonHash: z.string().regex(/^[0-9a-fA-F]{64}$/, 'Reason hash must be 64 hex characters (32 bytes)'),
});

// --- Deliverable Schemas ---

export const VerifyDeliverableSchema = z.object({
  blobId: z.string().min(1),
  relationshipId: z.string().min(1),
  milestoneIndex: z.number().int().min(0),
  expectedConditionValue: z.string().min(1),
});

// --- Memory Schemas ---

export const MemoryInsightRequestSchema = z.object({
  question: z.string().min(1).max(500),
});

// --- Reputation Schemas ---

export const GenerateReputationSchema = z.object({
  walletAddress: WalletAddressSchema,
  attestationIds: z.array(z.string()).min(1, 'At least one attestation ID required'),
  walrusAttestationSpaceId: z.string().optional(),
});

// --- Webhook Schemas ---

export const WebhookTransactionResultSchema = z.object({
  transactionDigest: z.string().min(1),
  status: z.nativeEnum(TransactionStatus),
  gasUsed: z.string().regex(/^\d+$/).optional(),
  error: z.string().optional(),
  eventData: z.record(z.unknown()).optional(),
});

// --- Feature Flag Schemas ---

export const CreateFeatureFlagSchema = z.object({
  key: z.string().min(1).max(100),
  enabled: z.boolean(),
  tenantId: z.string().uuid().nullable().optional(),
  description: z.string().min(1).max(500),
});

export const UpdateFeatureFlagSchema = z.object({
  enabled: z.boolean().optional(),
  description: z.string().min(1).max(500).optional(),
});

// --- Prompt Schemas ---

export const CreatePromptSchema = z.object({
  promptKey: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver format (e.g., 1.0.0)'),
  content: z.string().min(1),
});

// --- Admin Schemas ---

export const EventReplaySchema = z.object({
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  eventTypes: z.array(z.string()).optional(),
});

// ============================================================
// AI Agent Output Schemas
// ============================================================

export const AnomalyDetectionOutputSchema = z.object({
  isAnomaly: z.boolean(),
  reason: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
  suggestedAction: z.enum(['proceed', 'flag_for_review', 'block']),
});

export type AnomalyDetectionOutput = z.infer<typeof AnomalyDetectionOutputSchema>;

export const AnomalyPreflightResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('COMPLETED'),
    result: AnomalyDetectionOutputSchema,
  }),
  z.object({
    status: z.literal('DISABLED'),
    reason: z.string(),
  }),
  z.object({
    status: z.literal('UNAVAILABLE'),
    reason: z.string(),
  }),
]);

export type AnomalyPreflightResult = z.infer<typeof AnomalyPreflightResultSchema>;

export const PatternRecognitionOutputSchema = z.object({
  hasPattern: z.boolean(),
  patternType: z.enum([
    'reliable_contractor',
    'occasional_contractor',
    'problematic',
    'new_relationship',
  ]),
  confidence: z.number().int().min(0).max(100),
  description: z.string(),
  recommendation: z.string(),
  autoReleaseEligible: z.boolean(),
});

export type PatternRecognitionOutput = z.infer<typeof PatternRecognitionOutputSchema>;

export const DeliveryVerificationOutputSchema = z.object({
  verified: z.boolean(),
  reason: z.string(),
  confidence: z.number().int().min(0).max(100),
  blobIdMatch: z.boolean(),
});

export type DeliveryVerificationOutput = z.infer<typeof DeliveryVerificationOutputSchema>;

export const DuplicatePreventionOutputSchema = z.object({
  isDuplicate: z.boolean(),
  matchedTransactionId: z.string().nullable(),
  confidence: z.number().int().min(0).max(100),
});

export type DuplicatePreventionOutput = z.infer<typeof DuplicatePreventionOutputSchema>;

export const MemoryWriterOutputSchema = z.object({
  summary: z.string(),
  keyInsights: z.array(z.string()),
  riskFactors: z.array(z.string()),
  relationshipHealth: z.enum(['healthy', 'needs_attention', 'at_risk']),
  recommendedActions: z.array(z.string()),
});

export type MemoryWriterOutput = z.infer<typeof MemoryWriterOutputSchema>;

export const MemoryInsightOutputSchema = z.object({
  insight: z.string(),
  confidence: z.number().int().min(0).max(100),
  relevantEntries: z.array(z.string()),
  suggestedFollowUp: z.string().optional(),
});

export type MemoryInsightOutput = z.infer<typeof MemoryInsightOutputSchema>;

export const ReputationBuilderOutputSchema = z.object({
  summary: z.string(),
  strengthAreas: z.array(z.string()),
  riskAreas: z.array(z.string()),
  overallRating: z.enum(['excellent', 'good', 'fair', 'poor']),
  narrativeDescription: z.string(),
});

export type ReputationBuilderOutput = z.infer<typeof ReputationBuilderOutputSchema>;

export const ContentScanOutputSchema = z.object({
  isSafe: z.boolean(),
  reason: z.string(),
  category: z.enum(['safe', 'malicious_code', 'executable', 'adult_content', 'other']),
  confidence: z.number().int().min(0).max(100),
});

export type ContentScanOutput = z.infer<typeof ContentScanOutputSchema>;

// ============================================================
// Agent Runner Config Type
// ============================================================

export interface AgentRunnerConfig<T> {
  promptKey: PromptKey;
  model: string;
  systemPromptOverride?: string | undefined;
  userMessage: string;
  outputSchema: z.ZodType<T>;
  relationshipId?: string | undefined;
  tenantId?: string | undefined;
  correlationId?: string | undefined;
  metadata?: Record<string, string> | undefined;
}

export interface AgentRunnerToolConfig {
  promptKey: PromptKey;
  model: string;
  systemPromptOverride?: string | undefined;
  userMessage: string;
  tools: Record<string, unknown>;
  maxSteps: number;
  relationshipId?: string | undefined;
  tenantId?: string | undefined;
  correlationId?: string | undefined;
  metadata?: Record<string, string> | undefined;
}

// ============================================================
// Safe Defaults for AI Agent Failures
// ============================================================

export const SAFE_DEFAULTS = {
  anomalyDetection: {
    isAnomaly: false,
    reason: 'AI unavailable',
    severity: 'low' as const,
    suggestedAction: 'proceed' as const,
  },
  patternRecognition: {
    hasPattern: false,
    patternType: 'new_relationship' as const,
    confidence: 0,
    description: 'AI unavailable — no pattern data',
    recommendation: 'Manual review recommended',
    autoReleaseEligible: false,
  },
  deliveryVerification: {
    verified: false,
    reason: 'AI unavailable — manual review required',
    confidence: 0,
    blobIdMatch: false,
  },
  duplicatePrevention: {
    isDuplicate: false,
    matchedTransactionId: null,
    confidence: 0,
  },
} as const satisfies {
  anomalyDetection: AnomalyDetectionOutput;
  patternRecognition: PatternRecognitionOutput;
  deliveryVerification: DeliveryVerificationOutput;
  duplicatePrevention: DuplicatePreventionOutput;
};

// ============================================================
// Utility Types
// ============================================================

/** Pagination query parameters */
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationParams = z.infer<typeof PaginationSchema>;

/** Standard paginated response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Standard API error response */
export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  traceId?: string;
}

/** Context attached to Elysia by auth middleware */
export interface AuthContext {
  userId: string;
  walletAddress: string;
  isPlatformAdmin: boolean;
}

/** Context attached to Elysia by tenant middleware */
export interface TenantContext {
  tenantId: string | null;
  tenantRole: TenantRole | null;
  isPersonalMode: boolean;
}

/** Combined request context */
export interface RequestContext extends AuthContext {
  tenant: TenantContext;
  correlationId: string;
}

// ============================================================
// Sanitization utility
// ============================================================

/**
 * Strips null bytes, ASCII control characters (except newlines and tabs),
 * and trims whitespace from user input strings.
 */
export function sanitize(input: string): string {
  return input
    .replace(/\x00/g, '')
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}
