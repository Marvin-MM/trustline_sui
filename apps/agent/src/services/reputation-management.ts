import { prisma } from '../db/client';
import { runReputationBuilder } from '../agents/reputation-builder.agent';
import { toJsonSafe } from '../lib/json';
import { paymentAsset } from '../lib/payment-asset';

export class ReputationManagementService {
  async getProof(walletAddress: string) {
    const [proof, attestations, milestones, payerReleasedCount] = await Promise.all([
      prisma.reputationProof.findUnique({ where: { ownerWallet: walletAddress } }),
      prisma.completionAttestation.findMany({
        where: { recipientWallet: walletAddress },
        orderBy: { completionTimestamp: 'desc' },
      }),
      prisma.milestone.findMany({
        where: { relationship: { recipientWallet: walletAddress } },
        select: { status: true, disputeStatus: true },
      }),
      prisma.milestone.count({
        where: { status: 'RELEASED', relationship: { payerWallet: walletAddress } },
      }),
    ]);
    const successfulCount = proof?.successfulCount ?? attestations.length;
    const cancelledCount = proof?.cancelledCount ?? milestones.filter((m) => m.status === 'CANCELLED').length;
    const disputedCount = proof?.disputedCount ?? milestones.filter((m) => m.disputeStatus !== 'NONE').length;
    const totalVolume = proof?.totalVolume
      ?? attestations.reduce((sum, attestation) => sum + attestation.amount, 0n);
    const completionRateBps = proof?.completionRateBps
      ?? (successfulCount + cancelledCount === 0
        ? 0
        : Math.floor((successfulCount * 10_000) / (successfulCount + cancelledCount)));
    const releasedOutcomeCount = milestones.filter((milestone) => milestone.status === 'RELEASED').length;
    const indexingPending = releasedOutcomeCount > attestations.length;
    const mintEligibility = !proof && attestations.length > 0 && !indexingPending;
    const disabledReason = proof
      ? 'This wallet already owns a reputation proof. Use Update Proof after new outcomes are indexed.'
      : indexingPending
        ? 'A released milestone is still being indexed. Minting will be available after its attestation appears.'
        : attestations.length === 0 && payerReleasedCount > 0
          ? 'Reputation belongs to recipient wallets. Payments you released as a payer build the recipient’s reputation.'
          : attestations.length === 0
            ? 'Complete and receive payment for at least one milestone to mint a reputation proof.'
            : null;
    return toJsonSafe({
      walletAddress,
      ownership: 'RECIPIENT_WALLET',
      asset: paymentAsset,
      factual: {
        successfulCount,
        cancelledCount,
        disputedCount,
        totalVolume: totalVolume.toString(),
        completionRateBps,
        avgCompletionTimeMs: (proof?.avgCompletionTimeMs ?? 0n).toString(),
      },
      proof: proof ? {
        objectId: proof.suiObjectId,
        mintedAt: proof.mintedAt,
        walrusAttestationSpaceId: proof.walrusAttestationSpaceId,
      } : null,
      eligibleOutcomes: milestones.length,
      mintEligibility,
      disabledReason,
      indexingPending,
      attestations: attestations.map((attestation) => ({
        objectId: attestation.suiObjectId,
        relationshipId: attestation.relationshipId,
        milestoneIndex: attestation.milestoneIndex,
        amount: attestation.amount.toString(),
        conditionType: attestation.conditionType,
        deliverableBlobId: attestation.deliverableBlobId,
        completionTimestamp: attestation.completionTimestamp,
      })),
      aiAnalysis: null,
    });
  }

  async generate(walletAddress: string, tenantId: string | null) {
    const attestations = await prisma.completionAttestation.findMany({ where: { recipientWallet: walletAddress } });
    if (attestations.length === 0) return { noAttestations: true as const };

    const totalVolume = attestations.reduce((acc, attestation) => acc + attestation.amount, 0n);
    const narrative = await runReputationBuilder({
      walletAddress,
      attestationData: JSON.stringify(attestations.map((attestation) => ({
        amount: attestation.amount.toString(),
        milestone: attestation.milestoneIndex,
        timestamp: attestation.completionTimestamp,
      }))),
      successfulCount: attestations.length,
      disputedCount: 0,
      totalVolume: totalVolume.toString(),
      completionRate: 100,
      avgCompletionTime: '0',
      ...(tenantId ? { tenantId } : {}),
    });

    const profile = await this.getProof(walletAddress);
    return toJsonSafe({ ...profile, aiAnalysis: narrative });
  }

  async update(walletAddress: string) {
    const proof = await prisma.reputationProof.findUnique({ where: { ownerWallet: walletAddress } });
    if (!proof) return null;
    return { message: 'Reputation update queued', proofId: proof.id };
  }
}

export const reputationManagementService = new ReputationManagementService();
