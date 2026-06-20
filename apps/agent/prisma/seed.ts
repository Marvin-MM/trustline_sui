/**
 * Database seed script.
 * Populates initial prompt versions, feature flags, and platform admin user.
 * 
 * Run with: bun run seed
 */

import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env';

const prisma = new PrismaClient();

export const PROMPT_SEEDS = [
  {
    promptKey: 'anomaly-detection',
    version: '1.0.1',
    content: `You are a financial anomaly detection agent for BondFlow, a blockchain-based milestone payment platform.

Analyze the following payment relationship data and determine if there are any anomalies.

Consider these factors:
1. Is the payment amount unusual compared to the historical context provided?
2. Are there any suspicious patterns in the timing of milestone releases?
3. Does the relationship between payer and recipient show any red flags?
4. Are there signs of potential fraud, money laundering, or abuse?

Important accounting context:
- Amounts may include both human values like "2 USDC" and base-unit values like "2000000".
- USDC uses 6 decimals, so 2 USDC equals 2000000 base units.
- Do not flag a discrepancy when the human amount and base-unit amount are mathematically equivalent.

Historical Context:
{{historicalContext}}

Current Transaction Data:
{{transactionData}}

Respond with your analysis. Be conservative — flag for review rather than blocking unless confidence is very high.`,
    isActive: true,
  },
  {
    promptKey: 'pattern-recognition',
    version: '1.0.0',
    content: `You are a relationship pattern recognition agent for BondFlow.

Analyze the memory entries and transaction history between a payer and recipient to identify behavioral patterns.

Memory Context from Walrus MemWal:
{{memoryContext}}

Transaction History:
{{transactionHistory}}

Relationship Data:
{{relationshipData}}

Classify the relationship pattern and determine if auto-release of milestones is appropriate based on the established trust level.

Consider:
1. How many successful completions exist between these parties?
2. Were there any disputes? How were they resolved?
3. Is the completion time consistent and reasonable?
4. Does the payment volume follow a logical pattern?`,
    isActive: true,
  },
  {
    promptKey: 'delivery-verification',
    version: '1.0.0',
    content: `You are a deliverable verification agent for BondFlow.

Verify whether the uploaded deliverable matches the expected conditions for milestone release.

Milestone Condition:
{{milestoneCondition}}

Deliverable Metadata:
{{deliverableMetadata}}

Deliverable Content (if text-based):
{{deliverableContent}}

Expected Blob ID: {{expectedBlobId}}
Actual Blob ID: {{actualBlobId}}

Determine:
1. Does the deliverable content match what was agreed upon in the milestone condition?
2. Does the blob ID match the expected value?
3. Is the deliverable of sufficient quality to warrant milestone release?
4. Are there any concerns about the deliverable's authenticity?`,
    isActive: true,
  },
  {
    promptKey: 'delivery-verification-tool-calling',
    version: '1.0.0',
    content: `You are a deliverable verification agent for BondFlow with access to tools for thorough verification.

Your job is to verify that an uploaded deliverable matches the expected conditions for milestone release.
You have access to the following tools:
- fetch_blob_metadata: Retrieve metadata about a Walrus blob by its ID
- compare_content_hash: Compare SHA-256 hashes of expected vs actual content
- check_deliverable_history: Check if this deliverable has been submitted before

Use these tools systematically to verify the deliverable. Start by fetching metadata, then compare hashes, and finally check for duplicate submissions.

Milestone Condition: {{milestoneCondition}}
Blob ID: {{blobId}}
Relationship ID: {{relationshipId}}
Milestone Index: {{milestoneIndex}}`,
    isActive: true,
  },
  {
    promptKey: 'memory-writer',
    version: '1.0.0',
    content: `You are a memory writer agent for BondFlow. Your job is to compress and summarize payment relationship events into concise memory entries that will be stored in Walrus MemWal.

These memory entries serve as the institutional knowledge for the BondFlow AI system, helping future agents understand the history and health of a payment relationship.

Event Data:
{{eventData}}

Existing Memory Context:
{{existingMemory}}

Relationship Summary:
{{relationshipSummary}}

Write a concise memory entry that captures:
1. What happened (key facts only)
2. Key insights about the relationship health
3. Any risk factors to monitor
4. Recommended actions for future reference

Be precise and factual. Avoid speculation. Focus on patterns that would help future agents make better decisions.`,
    isActive: true,
  },
  {
    promptKey: 'memory-insight',
    version: '1.0.0',
    content: `You are a memory insight agent for BondFlow. You analyze stored memory entries from Walrus MemWal to provide actionable insights.

Memory Entries:
{{memoryEntries}}

Relationship Data:
{{relationshipData}}

User Question:
{{question}}

Provide a clear, actionable insight based on the available memory and relationship data. If the available data is insufficient to answer the question confidently, say so explicitly rather than guessing.`,
    isActive: true,
  },
  {
    promptKey: 'reputation-builder',
    version: '1.0.0',
    content: `You are a reputation analysis agent for BondFlow. You analyze CompletionAttestations to build a comprehensive reputation narrative for a user.

Attestation Data:
{{attestationData}}

Aggregate Statistics:
- Successful completions: {{successfulCount}}
- Disputed milestones: {{disputedCount}}
- Total volume (USDC): {{totalVolume}}
- Completion rate: {{completionRate}}%
- Average completion time: {{avgCompletionTime}}

Build a reputation narrative that:
1. Summarizes the user's track record
2. Identifies areas of strength
3. Identifies areas of concern or risk
4. Provides an overall rating based on the data
5. Creates a human-readable description suitable for display

Be fair and balanced. Weight recent activity more heavily than older activity.`,
    isActive: true,
  },
  {
    promptKey: 'content-scan',
    version: '1.0.0',
    content: `You are a cautious upload content classifier for BondFlow.

Classify uploaded content for policy and operational review. This is heuristic content classification only; never claim that a file is malware-free or safe to execute.

Return whether the content appears acceptable for storage, a short reason, the closest category, and a confidence score from 0 to 100.`,
    isActive: true,
  },
];

export const FEATURE_FLAG_SEEDS = [
  {
    key: 'ENABLE_AUTO_RELEASE',
    enabled: false,
    description: 'Enable automatic milestone release when conditions are met and pattern recognition indicates trust',
  },
  {
    key: 'ENABLE_AI_VERIFICATION',
    enabled: true,
    description: 'Enable AI-powered deliverable verification, anomaly detection, and pattern recognition',
  },
  {
    key: 'ENABLE_REPUTATION_PROOF',
    enabled: true,
    description: 'Enable on-chain reputation proof minting from CompletionAttestations',
  },
  {
    key: 'ENABLE_DISPUTE_RESOLUTION',
    enabled: true,
    description: 'Enable dispute resolution workflow for milestones',
  },
  {
    key: 'REQUIRE_DELIVERABLE_VERIFICATION',
    enabled: true,
    description: 'Require AI verification of deliverables before milestone release (blocks manual release)',
  },
];

export async function seed(): Promise<void> {
  // eslint-disable-next-line no-console -- seed script runs outside the app, pino not available
  console.log('🌱 Seeding database...');

  // Seed prompt versions
  for (const prompt of PROMPT_SEEDS) {
    const existing = await prisma.promptVersion.findUnique({
      where: {
        promptKey_version: {
          promptKey: prompt.promptKey,
          version: prompt.version,
        },
      },
    });

    if (!existing) {
      await prisma.promptVersion.create({
        data: {
          promptKey: prompt.promptKey,
          version: prompt.version,
          content: prompt.content,
          isActive: prompt.isActive,
          activatedAt: prompt.isActive ? new Date() : null,
        },
      });
      // eslint-disable-next-line no-console
      console.log(`  ✅ Created prompt: ${prompt.promptKey} v${prompt.version}`);
    } else {
      // eslint-disable-next-line no-console
      console.log(`  ⏭️  Prompt already exists: ${prompt.promptKey} v${prompt.version}`);
    }
  }

  // Seed feature flags (platform-wide defaults — tenantId = null)
  for (const flag of FEATURE_FLAG_SEEDS) {
    const existing = await prisma.featureFlag.findUnique({
      where: {
        key_tenantId: {
          key: flag.key,
          tenantId: '', // Prisma requires non-null for unique, we handle null separately
        },
      },
    }).catch(() => null);

    // Check for existing platform-wide flag
    const existingGlobal = await prisma.featureFlag.findFirst({
      where: {
        key: flag.key,
        tenantId: null,
      },
    });

    if (!existingGlobal) {
      await prisma.featureFlag.create({
        data: {
          key: flag.key,
          enabled: flag.enabled,
          tenantId: null,
          description: flag.description,
        },
      });
      // eslint-disable-next-line no-console
      console.log(`  ✅ Created feature flag: ${flag.key} = ${flag.enabled}`);
    } else {
      // eslint-disable-next-line no-console
      console.log(`  ⏭️  Feature flag already exists: ${flag.key}`);
    }
  }

  // Seed watcher state singleton
  await prisma.watcherState.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      lastCursor: null,
      lastProcessedAt: null,
    },
  });
  // eslint-disable-next-line no-console
  console.log('  ✅ Watcher state singleton created');

  if (env.ADMIN_WALLET_ADDRESS) {
    await prisma.user.upsert({
      where: { walletAddress: env.ADMIN_WALLET_ADDRESS },
      update: { isPlatformAdmin: true },
      create: {
        walletAddress: env.ADMIN_WALLET_ADDRESS,
        nonce: crypto.randomUUID(),
        isPlatformAdmin: true,
      },
    });
    // eslint-disable-next-line no-console
    console.log(`  ✅ Platform admin wallet configured: ${env.ADMIN_WALLET_ADDRESS}`);
  }

  // eslint-disable-next-line no-console
  console.log('🌱 Seeding complete!');
}

// Run seed only when executed directly. Other modules import the seed data for
// startup bootstrapping without mutating the database through this script.
if (import.meta.main) {
  seed()
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error('❌ Seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
