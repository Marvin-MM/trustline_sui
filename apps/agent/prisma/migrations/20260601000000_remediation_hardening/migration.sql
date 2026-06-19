-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TenantPlan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "RelationshipStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'CONDITION_MET', 'RELEASED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ConditionType" AS ENUM ('MANUAL', 'TIME_GATED', 'DELIVERABLE');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('NONE', 'OPEN', 'RESOLVED_RECIPIENT', 'RESOLVED_PAYER');

-- CreateEnum
CREATE TYPE "AgentActionType" AS ENUM ('ANOMALY_DETECTED', 'PATTERN_RECOGNIZED', 'DELIVERABLE_VERIFIED', 'DUPLICATE_PREVENTED', 'CONDITION_REGISTERED', 'MILESTONE_RELEASED', 'MEMORY_WRITTEN', 'ATTESTATION_MINTED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CREATE_RELATIONSHIP', 'GRANT_AGENT_CAP', 'REVOKE_AGENT_CAP', 'REGISTER_DELIVERABLE', 'RELEASE_MILESTONE', 'CANCEL_RELATIONSHIP', 'CANCEL_MILESTONE', 'RAISE_DISPUTE', 'RESOLVE_DISPUTE', 'MINT_ATTESTATION', 'MINT_REPUTATION_PROOF', 'UPDATE_REPUTATION_PROOF');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('RELATIONSHIP_CREATED', 'MILESTONE_CONDITION_MET', 'MILESTONE_RELEASED', 'DISPUTE_RAISED', 'DISPUTE_RESOLVED', 'ANOMALY_FLAGGED', 'REPUTATION_PROOF_MINTED', 'TEAM_MEMBER_INVITED', 'TEAM_MEMBER_JOINED');

-- CreateEnum
CREATE TYPE "EmailProvider" AS ENUM ('RESEND', 'NODEMAILER');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('CLAUDE_TOKENS', 'WALRUS_BYTES', 'SUI_GAS');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'CLEAN', 'SUSPICIOUS');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('TENANT_CREATED', 'TENANT_UPDATED', 'TENANT_MEMBER_INVITED', 'TENANT_MEMBER_ACCEPTED', 'TENANT_MEMBER_REMOVED', 'TENANT_MEMBER_ROLE_CHANGED', 'TENANT_OWNERSHIP_TRANSFERRED', 'FEATURE_FLAG_CHANGED', 'PROMPT_CREATED', 'PROMPT_ACTIVATED', 'WEBHOOK_PROCESSED', 'DLQ_JOB_RETRIED', 'RELATIONSHIP_CREATED', 'RELATIONSHIP_PTB_BUILT', 'DISPUTE_RESOLVED', 'REFRESH_TOKEN_REUSE_DETECTED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerWallet" TEXT NOT NULL,
    "plan" "TenantPlan" NOT NULL DEFAULT 'FREE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantUser" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL,
    "invitedBy" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "displayName" TEXT,
    "notificationEmail" TEXT,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "compromisedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRelationship" (
    "id" TEXT NOT NULL,
    "suiObjectId" TEXT NOT NULL,
    "tenantId" TEXT,
    "payerWallet" TEXT NOT NULL,
    "recipientWallet" TEXT NOT NULL,
    "memo" TEXT NOT NULL,
    "milestoneCount" INTEGER NOT NULL,
    "totalLockedAmount" BIGINT NOT NULL,
    "walrusMemorySpaceId" TEXT NOT NULL,
    "status" "RelationshipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "relationshipId" TEXT NOT NULL,
    "milestoneIndex" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,
    "conditionType" "ConditionType" NOT NULL,
    "conditionValue" TEXT NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "disputeStatus" "DisputeStatus" NOT NULL DEFAULT 'NONE',
    "deliverableBlobId" TEXT,
    "conditionMetAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "disputeRaisedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompletionAttestation" (
    "id" TEXT NOT NULL,
    "suiObjectId" TEXT NOT NULL,
    "relationshipId" TEXT NOT NULL,
    "milestoneIndex" INTEGER NOT NULL,
    "payerWallet" TEXT NOT NULL,
    "recipientWallet" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "conditionType" TEXT NOT NULL,
    "deliverableBlobId" TEXT,
    "walrusMemorySpaceId" TEXT NOT NULL,
    "completionTimestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompletionAttestation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReputationProof" (
    "id" TEXT NOT NULL,
    "suiObjectId" TEXT NOT NULL,
    "ownerWallet" TEXT NOT NULL,
    "successfulCount" INTEGER NOT NULL,
    "disputedCount" INTEGER NOT NULL,
    "totalVolume" BIGINT NOT NULL,
    "completionRateBps" INTEGER NOT NULL,
    "avgCompletionTimeMs" BIGINT NOT NULL,
    "walrusAttestationSpaceId" TEXT NOT NULL,
    "mintedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReputationProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentAction" (
    "id" TEXT NOT NULL,
    "relationshipId" TEXT,
    "tenantId" TEXT,
    "actionType" "AgentActionType" NOT NULL,
    "payload" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "aiModel" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "tokensUsed" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "estimatedCostUsd" DECIMAL(18,6) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "traceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainEvent" (
    "id" TEXT NOT NULL,
    "suiEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "processingError" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockchainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmittedTransaction" (
    "id" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "relationshipId" TEXT,
    "tenantId" TEXT,
    "submittedBy" TEXT NOT NULL,
    "txType" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "gasUsed" BIGINT,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubmittedTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientWallet" TEXT NOT NULL,
    "tenantId" TEXT,
    "relationshipId" TEXT,
    "notificationType" "NotificationType" NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "provider" "EmailProvider" NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshTokenFamily" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "compromisedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshTokenFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "transactionDigest" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "tenantId" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersion" (
    "id" TEXT NOT NULL,
    "promptKey" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "tenantId" TEXT,
    "relationshipId" TEXT,
    "resourceType" "ResourceType" NOT NULL,
    "quantity" BIGINT NOT NULL,
    "model" TEXT,
    "estimatedCostUsd" DECIMAL(18,6) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageAggregation" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "resourceType" "ResourceType" NOT NULL,
    "bucketDate" TIMESTAMP(3) NOT NULL,
    "quantity" BIGINT NOT NULL,
    "estimatedCostUsd" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageAggregation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliverableUpload" (
    "id" TEXT NOT NULL,
    "uploaderWallet" TEXT NOT NULL,
    "tenantId" TEXT,
    "walrusBlobId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "sha256Hash" TEXT NOT NULL,
    "mimeValidated" BOOLEAN NOT NULL,
    "scanStatus" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliverableUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantInvitation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invitedUserId" TEXT NOT NULL,
    "invitedEmail" TEXT,
    "invitedBy" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "actorUserId" TEXT,
    "actorWallet" TEXT,
    "action" "AuditAction" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatcherState" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastCursor" TEXT,
    "lastProcessedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatcherState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainEventArchive" (
    "id" TEXT NOT NULL,
    "suiEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL,
    "processedAt" TIMESTAMP(3),
    "processingError" TEXT,
    "retryCount" INTEGER NOT NULL,
    "originalCreatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockchainEventArchive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentActionArchive" (
    "id" TEXT NOT NULL,
    "relationshipId" TEXT,
    "tenantId" TEXT,
    "actionType" "AgentActionType" NOT NULL,
    "payload" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "aiModel" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "tokensUsed" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "estimatedCostUsd" DECIMAL(18,6) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "traceId" TEXT,
    "originalCreatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentActionArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_ownerWallet_idx" ON "Tenant"("ownerWallet");

-- CreateIndex
CREATE INDEX "TenantUser_tenantId_idx" ON "TenantUser"("tenantId");

-- CreateIndex
CREATE INDEX "TenantUser_userId_idx" ON "TenantUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantUser_tenantId_userId_key" ON "TenantUser"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE INDEX "User_walletAddress_idx" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRelationship_suiObjectId_key" ON "PaymentRelationship"("suiObjectId");

-- CreateIndex
CREATE INDEX "PaymentRelationship_tenantId_idx" ON "PaymentRelationship"("tenantId");

-- CreateIndex
CREATE INDEX "PaymentRelationship_payerWallet_idx" ON "PaymentRelationship"("payerWallet");

-- CreateIndex
CREATE INDEX "PaymentRelationship_recipientWallet_idx" ON "PaymentRelationship"("recipientWallet");

-- CreateIndex
CREATE INDEX "PaymentRelationship_suiObjectId_idx" ON "PaymentRelationship"("suiObjectId");

-- CreateIndex
CREATE INDEX "PaymentRelationship_status_idx" ON "PaymentRelationship"("status");

-- CreateIndex
CREATE INDEX "Milestone_relationshipId_idx" ON "Milestone"("relationshipId");

-- CreateIndex
CREATE INDEX "Milestone_status_idx" ON "Milestone"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_relationshipId_milestoneIndex_key" ON "Milestone"("relationshipId", "milestoneIndex");

-- CreateIndex
CREATE UNIQUE INDEX "CompletionAttestation_suiObjectId_key" ON "CompletionAttestation"("suiObjectId");

-- CreateIndex
CREATE INDEX "CompletionAttestation_relationshipId_idx" ON "CompletionAttestation"("relationshipId");

-- CreateIndex
CREATE INDEX "CompletionAttestation_recipientWallet_idx" ON "CompletionAttestation"("recipientWallet");

-- CreateIndex
CREATE UNIQUE INDEX "ReputationProof_suiObjectId_key" ON "ReputationProof"("suiObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ReputationProof_ownerWallet_key" ON "ReputationProof"("ownerWallet");

-- CreateIndex
CREATE INDEX "ReputationProof_ownerWallet_idx" ON "ReputationProof"("ownerWallet");

-- CreateIndex
CREATE INDEX "AgentAction_relationshipId_idx" ON "AgentAction"("relationshipId");

-- CreateIndex
CREATE INDEX "AgentAction_tenantId_idx" ON "AgentAction"("tenantId");

-- CreateIndex
CREATE INDEX "AgentAction_actionType_idx" ON "AgentAction"("actionType");

-- CreateIndex
CREATE INDEX "AgentAction_createdAt_idx" ON "AgentAction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainEvent_suiEventId_key" ON "BlockchainEvent"("suiEventId");

-- CreateIndex
CREATE INDEX "BlockchainEvent_processed_createdAt_idx" ON "BlockchainEvent"("processed", "createdAt");

-- CreateIndex
CREATE INDEX "BlockchainEvent_eventType_idx" ON "BlockchainEvent"("eventType");

-- CreateIndex
CREATE INDEX "BlockchainEvent_suiEventId_idx" ON "BlockchainEvent"("suiEventId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmittedTransaction_digest_key" ON "SubmittedTransaction"("digest");

-- CreateIndex
CREATE INDEX "SubmittedTransaction_status_idx" ON "SubmittedTransaction"("status");

-- CreateIndex
CREATE INDEX "SubmittedTransaction_txType_idx" ON "SubmittedTransaction"("txType");

-- CreateIndex
CREATE INDEX "SubmittedTransaction_submittedBy_idx" ON "SubmittedTransaction"("submittedBy");

-- CreateIndex
CREATE INDEX "SubmittedTransaction_digest_idx" ON "SubmittedTransaction"("digest");

-- CreateIndex
CREATE INDEX "Notification_recipientWallet_idx" ON "Notification"("recipientWallet");

-- CreateIndex
CREATE INDEX "Notification_sent_idx" ON "Notification"("sent");

-- CreateIndex
CREATE INDEX "Notification_notificationType_idx" ON "Notification"("notificationType");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "RefreshTokenFamily_userId_idx" ON "RefreshTokenFamily"("userId");

-- CreateIndex
CREATE INDEX "RefreshTokenFamily_compromisedAt_idx" ON "RefreshTokenFamily"("compromisedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_key_key" ON "IdempotencyKey"("key");

-- CreateIndex
CREATE INDEX "IdempotencyKey_key_idx" ON "IdempotencyKey"("key");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_published_createdAt_idx" ON "OutboxEvent"("published", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_attemptCount_idx" ON "OutboxEvent"("attemptCount");

-- CreateIndex
CREATE INDEX "OutboxEvent_lockedUntil_idx" ON "OutboxEvent"("lockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDelivery_signature_key" ON "WebhookDelivery"("signature");

-- CreateIndex
CREATE INDEX "WebhookDelivery_signature_idx" ON "WebhookDelivery"("signature");

-- CreateIndex
CREATE INDEX "WebhookDelivery_createdAt_idx" ON "WebhookDelivery"("createdAt");

-- CreateIndex
CREATE INDEX "FeatureFlag_key_idx" ON "FeatureFlag"("key");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_tenantId_key" ON "FeatureFlag"("key", "tenantId");

-- CreateIndex
CREATE INDEX "PromptVersion_promptKey_isActive_idx" ON "PromptVersion"("promptKey", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PromptVersion_promptKey_version_key" ON "PromptVersion"("promptKey", "version");

-- CreateIndex
CREATE INDEX "UsageRecord_walletAddress_idx" ON "UsageRecord"("walletAddress");

-- CreateIndex
CREATE INDEX "UsageRecord_tenantId_idx" ON "UsageRecord"("tenantId");

-- CreateIndex
CREATE INDEX "UsageRecord_resourceType_idx" ON "UsageRecord"("resourceType");

-- CreateIndex
CREATE INDEX "UsageRecord_recordedAt_idx" ON "UsageRecord"("recordedAt");

-- CreateIndex
CREATE INDEX "UsageAggregation_tenantId_bucketDate_idx" ON "UsageAggregation"("tenantId", "bucketDate");

-- CreateIndex
CREATE INDEX "UsageAggregation_resourceType_bucketDate_idx" ON "UsageAggregation"("resourceType", "bucketDate");

-- CreateIndex
CREATE UNIQUE INDEX "UsageAggregation_walletAddress_tenantId_resourceType_bucket_key" ON "UsageAggregation"("walletAddress", "tenantId", "resourceType", "bucketDate");

-- CreateIndex
CREATE UNIQUE INDEX "DeliverableUpload_walrusBlobId_key" ON "DeliverableUpload"("walrusBlobId");

-- CreateIndex
CREATE INDEX "DeliverableUpload_sha256Hash_idx" ON "DeliverableUpload"("sha256Hash");

-- CreateIndex
CREATE INDEX "DeliverableUpload_uploaderWallet_idx" ON "DeliverableUpload"("uploaderWallet");

-- CreateIndex
CREATE INDEX "DeliverableUpload_scanStatus_idx" ON "DeliverableUpload"("scanStatus");

-- CreateIndex
CREATE UNIQUE INDEX "TenantInvitation_tokenHash_key" ON "TenantInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "TenantInvitation_tenantId_idx" ON "TenantInvitation"("tenantId");

-- CreateIndex
CREATE INDEX "TenantInvitation_invitedUserId_idx" ON "TenantInvitation"("invitedUserId");

-- CreateIndex
CREATE INDEX "TenantInvitation_expiresAt_idx" ON "TenantInvitation"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorWallet_idx" ON "AuditLog"("actorWallet");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainEventArchive_suiEventId_key" ON "BlockchainEventArchive"("suiEventId");

-- CreateIndex
CREATE INDEX "BlockchainEventArchive_suiEventId_idx" ON "BlockchainEventArchive"("suiEventId");

-- CreateIndex
CREATE INDEX "BlockchainEventArchive_eventType_idx" ON "BlockchainEventArchive"("eventType");

-- CreateIndex
CREATE INDEX "AgentActionArchive_actionType_idx" ON "AgentActionArchive"("actionType");

-- CreateIndex
CREATE INDEX "AgentActionArchive_originalCreatedAt_idx" ON "AgentActionArchive"("originalCreatedAt");

-- AddForeignKey
ALTER TABLE "TenantUser" ADD CONSTRAINT "TenantUser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantUser" ADD CONSTRAINT "TenantUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRelationship" ADD CONSTRAINT "PaymentRelationship_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "PaymentRelationship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionAttestation" ADD CONSTRAINT "CompletionAttestation_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "PaymentRelationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationProof" ADD CONSTRAINT "ReputationProof_ownerWallet_fkey" FOREIGN KEY ("ownerWallet") REFERENCES "User"("walletAddress") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "PaymentRelationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmittedTransaction" ADD CONSTRAINT "SubmittedTransaction_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "PaymentRelationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmittedTransaction" ADD CONSTRAINT "SubmittedTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "PaymentRelationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "RefreshTokenFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshTokenFamily" ADD CONSTRAINT "RefreshTokenFamily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliverableUpload" ADD CONSTRAINT "DeliverableUpload_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

