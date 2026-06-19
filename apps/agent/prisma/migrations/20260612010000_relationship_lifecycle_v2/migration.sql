CREATE TYPE "ReleasePolicy" AS ENUM ('PAYER_APPROVAL', 'AUTO_AFTER_CHALLENGE');
CREATE TYPE "DeliverableVerificationStatus" AS ENUM ('UPLOADED', 'SCANNING', 'VERIFIED', 'REJECTED', 'FAILED');

ALTER TYPE "MilestoneStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED' AFTER 'PENDING';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'SUBMIT_DELIVERABLE';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'VERIFY_DELIVERABLE';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'REJECT_DELIVERABLE';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'GRANT_OPERATOR_CAP';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'REVOKE_CAP';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'AUTO_RELEASE_MILESTONE';

ALTER TABLE "PaymentRelationship"
  ADD COLUMN "contractVersion" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "clientRequestId" TEXT,
  ADD COLUMN "legacyReadOnly" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "assetType" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "assetSymbol" TEXT NOT NULL DEFAULT 'USDC',
  ADD COLUMN "assetDecimals" INTEGER NOT NULL DEFAULT 6;

UPDATE "PaymentRelationship"
SET "contractVersion" = 1, "legacyReadOnly" = true;

ALTER TABLE "Milestone"
  ADD COLUMN "releasePolicy" "ReleasePolicy" NOT NULL DEFAULT 'PAYER_APPROVAL',
  ADD COLUMN "verificationEvidenceHash" TEXT,
  ADD COLUMN "challengeDeadline" TIMESTAMP(3),
  ADD COLUMN "disputeReasonHash" TEXT,
  ADD COLUMN "disputeWalrusBlobId" TEXT;

ALTER TABLE "ReputationProof"
  ADD COLUMN "cancelledCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "DeliverableUpload"
  ADD COLUMN "verificationStatus" "DeliverableVerificationStatus" NOT NULL DEFAULT 'UPLOADED',
  ADD COLUMN "relationshipId" TEXT,
  ADD COLUMN "milestoneIndex" INTEGER,
  ADD COLUMN "verificationConfidence" INTEGER,
  ADD COLUMN "verificationReason" TEXT,
  ADD COLUMN "verificationEvidenceHash" TEXT,
  ADD COLUMN "verifiedAt" TIMESTAMP(3);

CREATE TABLE "RelationshipCapability" (
  "id" TEXT NOT NULL,
  "suiObjectId" TEXT NOT NULL,
  "relationshipId" TEXT NOT NULL,
  "capabilityType" TEXT NOT NULL,
  "holderWallet" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "permissions" JSONB NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RelationshipCapability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RelationshipCapability_suiObjectId_key" ON "RelationshipCapability"("suiObjectId");
CREATE UNIQUE INDEX "PaymentRelationship_clientRequestId_key" ON "PaymentRelationship"("clientRequestId");
CREATE INDEX "RelationshipCapability_relationshipId_idx" ON "RelationshipCapability"("relationshipId");
CREATE INDEX "RelationshipCapability_holderWallet_idx" ON "RelationshipCapability"("holderWallet");
CREATE INDEX "RelationshipCapability_capabilityType_idx" ON "RelationshipCapability"("capabilityType");
CREATE INDEX "DeliverableUpload_relationshipId_milestoneIndex_idx" ON "DeliverableUpload"("relationshipId", "milestoneIndex");

ALTER TABLE "DeliverableUpload"
  ADD CONSTRAINT "DeliverableUpload_relationshipId_fkey"
  FOREIGN KEY ("relationshipId") REFERENCES "PaymentRelationship"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RelationshipCapability"
  ADD CONSTRAINT "RelationshipCapability_relationshipId_fkey"
  FOREIGN KEY ("relationshipId") REFERENCES "PaymentRelationship"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "WatcherState"
SET "lastCursor" = NULL, "lastProcessedAt" = NULL
WHERE "id" = 'singleton';
