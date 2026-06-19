ALTER TABLE "AgentAction"
  ADD COLUMN "correlationId" TEXT;

ALTER TABLE "Notification"
  ADD COLUMN "readAt" TIMESTAMP(3),
  ADD COLUMN "sourceOutboxEventId" TEXT;

ALTER TABLE "TenantInvitation"
  ADD COLUMN "declinedAt" TIMESTAMP(3);

CREATE TABLE "RelationshipMemoryEntry" (
  "id" TEXT NOT NULL,
  "sourceEventId" TEXT NOT NULL,
  "relationshipId" TEXT NOT NULL,
  "tenantId" TEXT,
  "eventType" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "factualPayload" JSONB NOT NULL,
  "milestoneIndex" INTEGER,
  "actorWallet" TEXT,
  "walrusBlobId" TEXT,
  "storageStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "storageError" TEXT,
  "byteSize" INTEGER NOT NULL DEFAULT 0,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RelationshipMemoryEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RelationshipMemoryEntry_sourceEventId_key"
  ON "RelationshipMemoryEntry"("sourceEventId");
CREATE INDEX "RelationshipMemoryEntry_relationshipId_occurredAt_idx"
  ON "RelationshipMemoryEntry"("relationshipId", "occurredAt");
CREATE INDEX "RelationshipMemoryEntry_tenantId_idx"
  ON "RelationshipMemoryEntry"("tenantId");
CREATE INDEX "RelationshipMemoryEntry_storageStatus_idx"
  ON "RelationshipMemoryEntry"("storageStatus");
CREATE INDEX "AgentAction_correlationId_idx"
  ON "AgentAction"("correlationId");
CREATE INDEX "Notification_recipientWallet_readAt_idx"
  ON "Notification"("recipientWallet", "readAt");
CREATE UNIQUE INDEX "Notification_sourceOutboxEventId_key"
  ON "Notification"("sourceOutboxEventId");

ALTER TABLE "RelationshipMemoryEntry"
  ADD CONSTRAINT "RelationshipMemoryEntry_relationshipId_fkey"
  FOREIGN KEY ("relationshipId") REFERENCES "PaymentRelationship"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RelationshipMemoryEntry"
  ADD CONSTRAINT "RelationshipMemoryEntry_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
