/**
 * Sui blockchain client module (SDK v2.17).
 *
 * SuiClient was renamed to CoreClient in @mysten/sui v2.x.
 * Using CoreClient directly but aliasing as SuiClient for code clarity.
 */

import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { env } from '../config/env';
import { logger } from './logger';

const suiLogger = logger.child({ module: 'sui' });

export { Transaction } from '@mysten/sui/transactions';
export { SuiJsonRpcClient as SuiClient } from '@mysten/sui/jsonRpc';

export const suiClient = new SuiJsonRpcClient({ url: env.SUI_RPC_URL, network: env.SUI_NETWORK });

export const agentKeypair: Ed25519Keypair = (() => {
  try {
    if (env.EXTERNAL_SERVICES_MODE === 'mock') {
      suiLogger.warn('Sui external services are in mock mode; generated agent keypair is not persistent');
      return new Ed25519Keypair();
    }
    const privateKey = env.SUI_AGENT_PRIVATE_KEY;
    if (privateKey.startsWith('suiprivkey')) {
      return Ed25519Keypair.fromSecretKey(privateKey);
    }
    const keyBytes = Buffer.from(privateKey, 'hex');
    return Ed25519Keypair.fromSecretKey(keyBytes);
  } catch (error) {
    suiLogger.error({ error }, 'Failed to initialize agent keypair');
    throw new Error('Invalid SUI_AGENT_PRIVATE_KEY format. Use suiprivkey... or hex-encoded bytes.');
  }
})();

export const agentAddress: string = agentKeypair.toSuiAddress();
suiLogger.info({ agentAddress }, 'Agent wallet initialized');

export async function executeTransaction(tx: Transaction, signer = agentKeypair) {
  return suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: { showEffects: true, showEvents: true, showObjectChanges: true },
  });
}

export interface SuiEventEntry {
  id: { txDigest: string; eventSeq: string };
  type: string;
  parsedJson: Record<string, unknown>;
  sender: string;
  timestampMs: string;
}

export async function queryEvents(params: {
  packageId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<{ events: SuiEventEntry[]; nextCursor: string | null; hasNextPage: boolean }> {
  const { packageId, cursor, limit = 50 } = params;

  const parsedCursor = cursor
    ? { txDigest: cursor.split(':')[0] ?? '', eventSeq: cursor.split(':')[1] ?? '0' }
    : undefined;

  const result = await suiClient.queryEvents({
    query: { MoveModule: { package: packageId, module: 'events' } },
    cursor: parsedCursor,
    limit,
    order: 'ascending',
  });

  const events: SuiEventEntry[] = result.data.map((event: {
    id: { txDigest: string; eventSeq: string };
    type: string;
    parsedJson?: unknown;
    sender: string;
    timestampMs?: string | null;
  }) => ({
    id: event.id,
    type: event.type,
    parsedJson: (event.parsedJson ?? {}) as Record<string, unknown>,
    sender: event.sender,
    timestampMs: event.timestampMs ?? '0',
  }));

  const nextCursor = result.nextCursor
    ? `${result.nextCursor.txDigest}:${result.nextCursor.eventSeq}`
    : null;

  return { events, nextCursor, hasNextPage: result.hasNextPage };
}

export function buildSuiEventId(txDigest: string, eventSeq: string): string {
  return `${txDigest}:${eventSeq}`;
}
