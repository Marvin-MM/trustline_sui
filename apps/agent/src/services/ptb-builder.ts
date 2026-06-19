/**
 * PTB (Programmable Transaction Block) builder for all BondFlow Move calls.
 * Every PTB is dry-run validated before returning serialized bytes.
 * Idempotency key integration prevents duplicate transaction construction.
 */

import { Transaction, coinWithBalance } from '@mysten/sui/transactions';
import { suiClient } from '../lib/sui-client';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { tracer, SpanStatusCode } from '../tracing';
import { checkIdempotency, setIdempotentResponse } from '../lib/idempotency';
import { bytes32FromExternalId } from '../lib/onchain-bytes';

const ptbLogger = logger.child({ module: 'ptb-builder' });

export class PtbSimulationError extends Error {
  public readonly details: Record<string, unknown>;
  constructor(message: string, details: Record<string, unknown>) {
    super(message);
    this.name = 'PtbSimulationError';
    this.details = details;
  }
}

async function dryRun(tx: Transaction): Promise<{ bytes: Uint8Array; estimatedGas: string }> {
  const bytes = await tx.build({ client: suiClient });
  const result = await suiClient.dryRunTransactionBlock({ transactionBlock: bytes });
  if (result.effects?.status?.status !== 'success') {
    throw new PtbSimulationError(
      `PTB dry run failed: ${result.effects?.status?.error ?? 'Unknown error'}`,
      { effects: result.effects },
    );
  }
  const gasUsed = result.effects.gasUsed;
  const computation = BigInt(gasUsed?.computationCost ?? '0');
  const storage = BigInt(gasUsed?.storageCost ?? '0');
  const rebate = BigInt(gasUsed?.storageRebate ?? '0');
  const estimatedGas = computation + storage > rebate ? computation + storage - rebate : computation + storage;
  return { bytes, estimatedGas: estimatedGas.toString() };
}

function bytesFromString(input: string): number[] {
  const normalized = input.startsWith('0x') ? input.slice(2) : input;
  if (/^[0-9a-fA-F]+$/.test(normalized) && normalized.length % 2 === 0) {
    return Array.from(Buffer.from(normalized, 'hex'));
  }
  return Array.from(new TextEncoder().encode(input));
}

type PtbResult = { txBytes: string; estimatedGas: string };

function isGasResolutionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('No valid gas coins found')
    || message.toLowerCase().includes('could not select coins')
    || message.toLowerCase().includes('insufficient gas');
}

function isTransactionResolutionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Transaction resolution failed')
    || message.includes('VMVerificationOrDeserializationError')
    || message.includes('Incorrect number of type arguments');
}

export class PtbBuilderService {
  private readonly packageId = env.SUI_PACKAGE_ID;
  private readonly protocolStateId = env.SUI_PROTOCOL_STATE_ID;
  private readonly attestationRegistryId = env.SUI_ATTESTATION_REGISTRY_ID;
  private readonly proofRegistryId = env.SUI_PROOF_REGISTRY_ID;
  private readonly revokedCapsId = env.SUI_REVOKED_CAPS_ID;
  private readonly reputationLedgerId = env.SUI_REPUTATION_LEDGER_ID;

  private async finalize<T extends PtbResult>(
    operation: string,
    params: Record<string, unknown>,
    sender: string,
    build: () => Transaction,
  ): Promise<T> {
    const span = tracer.startSpan(`ptb.${operation}`);
    try {
      const { key, cachedResponse } = await checkIdempotency({ operation, ...params });
      if (cachedResponse) return cachedResponse as T;

      const tx = build();
      tx.setSender(sender);
      const { bytes, estimatedGas } = await dryRun(tx);
      const result = { txBytes: Buffer.from(bytes).toString('base64'), estimatedGas } as T;
      await setIdempotentResponse(key, result);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      if (isGasResolutionError(error)) {
        const simulationError = new PtbSimulationError(
          'No valid SUI gas coins found. Fund this wallet with SUI before creating a relationship.',
          { code: 'INSUFFICIENT_GAS', originalError: error instanceof Error ? error.message : String(error) },
        );
        span.recordException(simulationError);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw simulationError;
      }
      if (isTransactionResolutionError(error)) {
        const simulationError = new PtbSimulationError(
          'The transaction could not be resolved against the published contract ABI.',
          {
            code: 'PTB_RESOLUTION_FAILED',
            operation,
            originalError: error instanceof Error ? error.message : String(error),
          },
        );
        span.recordException(simulationError);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw simulationError;
      }
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  async buildCreateRelationship(params: {
    recipient: string;
    coinObjectIds?: string[];
    amounts?: string[];
    conditionTypes: number[];
    conditionValues: string[];
    releasePolicies: number[];
    memo: string;
    walrusMemorySpaceId: string;
    coinType: string;
    sender: string;
    verifierAgent: string;
    verifierExpiryDurationS: number;
    verifierMaxActions: number;
  }): Promise<PtbResult> {
    return this.finalize('createRelationship', params, params.sender, () => {
      const tx = new Transaction();
      const coinElements = params.coinObjectIds?.length
        ? params.coinObjectIds.map((id) => tx.object(id))
        : (params.amounts ?? []).map((amount) =>
            tx.add(coinWithBalance({
              type: params.coinType,
              balance: BigInt(amount),
              useGasCoin: params.coinType === '0x2::sui::SUI',
            })),
          );
      const coins = tx.makeMoveVec({
        type: `0x2::coin::Coin<${params.coinType}>`,
        elements: coinElements,
      });
      tx.moveCall({
        target: `${this.packageId}::payment_relationship::create`,
        typeArguments: [params.coinType],
        arguments: [
          tx.pure.address(params.recipient),
          coins,
          tx.pure.vector('u8', params.conditionTypes),
          tx.pure.vector('vector<u8>', params.conditionValues.map(bytesFromString)),
          tx.pure.vector('u8', params.releasePolicies),
          tx.pure.vector('u8', bytesFromString(params.memo)),
          tx.pure.vector('u8', bytesFromString(params.walrusMemorySpaceId)),
          tx.pure.address(params.verifierAgent),
          tx.pure.u64(params.verifierExpiryDurationS),
          tx.pure.u64(params.verifierMaxActions),
          tx.object(this.revokedCapsId),
          tx.object(this.protocolStateId),
        ],
      });
      return tx;
    });
  }

  async buildReleaseMilestone(params: {
    relationshipId: string;
    milestoneIndex: number;
    coinType: string;
    sender: string;
  }): Promise<PtbResult> {
    return this.finalize('releaseMilestone', params, params.sender, () => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.packageId}::payment_relationship::approve_and_release`,
        typeArguments: [params.coinType],
        arguments: [
          tx.object(params.relationshipId),
          tx.pure.u64(params.milestoneIndex),
          tx.object(this.attestationRegistryId),
          tx.object(this.reputationLedgerId),
          tx.object(this.protocolStateId),
        ],
      });
      return tx;
    });
  }

  async buildOperatorReleaseMilestone(params: {
    relationshipId: string;
    milestoneIndex: number;
    operatorCapId: string;
    coinType: string;
    sender: string;
  }): Promise<PtbResult> {
    return this.finalize('operatorReleaseMilestone', params, params.sender, () => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.packageId}::payment_relationship::operator_approve_and_release`,
        typeArguments: [params.coinType],
        arguments: [
          tx.object(params.relationshipId),
          tx.pure.u64(params.milestoneIndex),
          tx.object(params.operatorCapId),
          tx.object(this.revokedCapsId),
          tx.object(this.attestationRegistryId),
          tx.object(this.reputationLedgerId),
          tx.object(this.protocolStateId),
        ],
      });
      return tx;
    });
  }

  async buildGrantAgentCap(params: {
    relationshipId: string;
    agentAddress: string;
    expiryDurationS: number;
    allowedActions: number[];
    maxActions: number;
    coinType: string;
    sender: string;
  }): Promise<PtbResult> {
    if (params.expiryDurationS <= 0) throw new Error('expiryDurationS must be > 0');
    if (params.maxActions <= 0) throw new Error('maxActions must be > 0');
    return this.finalize('grantAgentCap', params, params.sender, () => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.packageId}::payment_relationship::grant_agent_cap`,
        typeArguments: [params.coinType],
        arguments: [
          tx.object(params.relationshipId),
          tx.pure.address(params.agentAddress),
          tx.pure.u64(params.expiryDurationS),
          tx.pure.vector('u8', params.allowedActions),
          tx.pure.u64(params.maxActions),
          tx.object(this.revokedCapsId),
        ],
      });
      return tx;
    });
  }

  async buildRevokeAgentCap(params: {
    relationshipId: string;
    capId: string;
    coinType: string;
    sender: string;
  }): Promise<PtbResult> {
    return this.finalize('revokeAgentCap', params, params.sender, () => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.packageId}::payment_relationship::revoke_cap`,
        typeArguments: [params.coinType],
        arguments: [
          tx.object(params.relationshipId),
          tx.pure.id(params.capId),
          tx.object(this.revokedCapsId),
        ],
      });
      return tx;
    });
  }

  async buildSubmitDeliverable(params: {
    relationshipId: string;
    milestoneIndex: number;
    blobId: string;
    coinType: string;
    sender: string;
  }): Promise<PtbResult> {
    return this.finalize('submitDeliverable', params, params.sender, () => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.packageId}::payment_relationship::submit_deliverable`,
        typeArguments: [params.coinType],
        arguments: [
          tx.object(params.relationshipId),
          tx.pure.u64(params.milestoneIndex),
          tx.pure.vector('u8', bytes32FromExternalId(params.blobId)),
          tx.object(this.protocolStateId),
        ],
      });
      return tx;
    });
  }

  buildAgentVerificationTransaction(params: {
    relationshipId: string;
    milestoneIndex: number;
    agentCapId: string;
    blobId: string;
    evidenceHash: string;
    verified: boolean;
    coinType: string;
  }): Transaction {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.packageId}::payment_relationship::${params.verified ? 'verify_deliverable' : 'reject_deliverable'}`,
        typeArguments: [params.coinType],
        arguments: [
          tx.object(params.relationshipId),
          tx.pure.u64(params.milestoneIndex),
          ...(params.verified ? [tx.pure.vector('u8', bytes32FromExternalId(params.blobId))] : []),
          tx.pure.vector('u8', bytes32FromExternalId(params.evidenceHash)),
          tx.object(params.agentCapId),
          tx.object(this.revokedCapsId),
          tx.object(this.protocolStateId),
        ],
      });
      return tx;
  }

  buildAgentAutoReleaseTransaction(params: {
    relationshipId: string;
    milestoneIndex: number;
    agentCapId: string;
    coinType: string;
  }): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${this.packageId}::payment_relationship::auto_release`,
      typeArguments: [params.coinType],
      arguments: [
        tx.object(params.relationshipId),
        tx.pure.u64(params.milestoneIndex),
        tx.object(params.agentCapId),
        tx.object(this.revokedCapsId),
        tx.object(this.attestationRegistryId),
        tx.object(this.reputationLedgerId),
        tx.object(this.protocolStateId),
      ],
    });
    return tx;
  }

  async buildRaiseDispute(params: {
    relationshipId: string;
    milestoneIndex: number;
    reasonHash: string;
    coinType: string;
    sender: string;
  }): Promise<PtbResult> {
    return this.finalize('raiseDispute', params, params.sender, () => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.packageId}::payment_relationship::raise_dispute`,
        typeArguments: [params.coinType],
        arguments: [
          tx.object(params.relationshipId),
          tx.pure.u64(params.milestoneIndex),
          tx.pure.vector('u8', Array.from(Buffer.from(params.reasonHash, 'hex'))),
          tx.object(this.reputationLedgerId),
          tx.object(this.protocolStateId),
        ],
      });
      return tx;
    });
  }

  async buildOperatorRaiseDispute(params: {
    relationshipId: string;
    milestoneIndex: number;
    reasonHash: string;
    operatorCapId: string;
    coinType: string;
    sender: string;
  }): Promise<PtbResult> {
    return this.finalize('operatorRaiseDispute', params, params.sender, () => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.packageId}::payment_relationship::operator_raise_dispute`,
        typeArguments: [params.coinType],
        arguments: [
          tx.object(params.relationshipId),
          tx.pure.u64(params.milestoneIndex),
          tx.pure.vector('u8', Array.from(Buffer.from(params.reasonHash, 'hex'))),
          tx.object(params.operatorCapId),
          tx.object(this.revokedCapsId),
          tx.object(this.reputationLedgerId),
          tx.object(this.protocolStateId),
        ],
      });
      return tx;
    });
  }

  async buildResolveDispute(params: {
    relationshipId: string;
    milestoneIndex: number;
    resolution: number;
    adminCapId: string;
    coinType: string;
    sender: string;
  }): Promise<PtbResult> {
    if (params.resolution !== 2 && params.resolution !== 3) {
      throw new Error('resolution must be 2 (release to recipient) or 3 (return to payer)');
    }
    return this.finalize('resolveDispute', params, params.sender, () => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.packageId}::payment_relationship::resolve_dispute`,
        typeArguments: [params.coinType],
        arguments: [
          tx.object(params.relationshipId),
          tx.pure.u64(params.milestoneIndex),
          tx.pure.u8(params.resolution),
          tx.object(params.adminCapId),
          tx.object(this.attestationRegistryId),
          tx.object(this.reputationLedgerId),
          tx.object(this.protocolStateId),
        ],
      });
      return tx;
    });
  }

  async buildCancelRelationship(params: {
    relationshipId: string;
    coinType: string;
    sender: string;
  }): Promise<PtbResult> {
    return this.finalize('cancelRelationship', params, params.sender, () => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.packageId}::payment_relationship::cancel_remaining`,
        typeArguments: [params.coinType],
        arguments: [
          tx.object(params.relationshipId),
          tx.object(this.reputationLedgerId),
          tx.object(this.protocolStateId),
        ],
      });
      return tx;
    });
  }

  async buildCancelMilestone(params: {
    relationshipId: string;
    milestoneIndex: number;
    coinType: string;
    sender: string;
  }): Promise<PtbResult> {
    return this.finalize('cancelMilestone', params, params.sender, () => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.packageId}::payment_relationship::cancel_milestone`,
        typeArguments: [params.coinType],
        arguments: [
          tx.object(params.relationshipId),
          tx.pure.u64(params.milestoneIndex),
          tx.object(this.reputationLedgerId),
          tx.object(this.protocolStateId),
        ],
      });
      return tx;
    });
  }

  async buildOperatorCancelMilestone(params: {
    relationshipId: string;
    milestoneIndex: number;
    operatorCapId: string;
    coinType: string;
    sender: string;
  }): Promise<PtbResult> {
    return this.finalize('operatorCancelMilestone', params, params.sender, () => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.packageId}::payment_relationship::operator_cancel_milestone`,
        typeArguments: [params.coinType],
        arguments: [
          tx.object(params.relationshipId),
          tx.pure.u64(params.milestoneIndex),
          tx.object(params.operatorCapId),
          tx.object(this.revokedCapsId),
          tx.object(this.reputationLedgerId),
          tx.object(this.protocolStateId),
        ],
      });
      return tx;
    });
  }

  async buildMintReputationProof(params: {
    walrusAttestationSpaceId: string;
    sender: string;
  }): Promise<PtbResult> {
    return this.finalize('mintReputationProof', params, params.sender, () => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.packageId}::reputation_proof::mint`,
        arguments: [
          tx.object(this.reputationLedgerId),
          tx.pure.vector('u8', bytesFromString(params.walrusAttestationSpaceId)),
          tx.object(this.proofRegistryId),
          tx.object(this.protocolStateId),
        ],
      });
      return tx;
    });
  }

  async buildUpdateReputationProof(params: {
    proofId: string;
    sender: string;
  }): Promise<PtbResult> {
    return this.finalize('updateReputationProof', params, params.sender, () => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.packageId}::reputation_proof::update`,
        arguments: [
          tx.object(params.proofId),
          tx.object(this.reputationLedgerId),
        ],
      });
      return tx;
    });
  }

  async buildGrantOperatorCap(params: {
    relationshipId: string;
    operatorAddress: string;
    expiryDurationS: number;
    canRelease: boolean;
    canCancel: boolean;
    canDispute: boolean;
    coinType: string;
    sender: string;
  }): Promise<PtbResult> {
    return this.finalize('grantOperatorCap', params, params.sender, () => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.packageId}::payment_relationship::grant_operator_cap`,
        typeArguments: [params.coinType],
        arguments: [
          tx.object(params.relationshipId),
          tx.pure.address(params.operatorAddress),
          tx.pure.u64(params.expiryDurationS),
          tx.pure.bool(params.canRelease),
          tx.pure.bool(params.canCancel),
          tx.pure.bool(params.canDispute),
          tx.object(this.revokedCapsId),
        ],
      });
      return tx;
    });
  }
}

export const ptbBuilder = new PtbBuilderService();
