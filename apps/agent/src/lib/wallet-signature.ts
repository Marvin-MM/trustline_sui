import { normalizeSuiAddress } from '@mysten/sui/utils';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import type { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

const AUTH_MESSAGE_PREFIX = 'Sign to authenticate with BondFlow. No gas. No transfers. Nonce: ';

export function canonicalAuthMessage(nonce: string): string {
  return `${AUTH_MESSAGE_PREFIX}${nonce}`;
}

export function canonicalWalletAddress(walletAddress: string): string {
  return normalizeSuiAddress(walletAddress);
}

export async function verifyWalletPersonalMessage(params: {
  walletAddress: string;
  signature: string;
  message: string;
  client?: SuiJsonRpcClient;
}) {
  const walletAddress = canonicalWalletAddress(params.walletAddress);
  return verifyPersonalMessageSignature(
    new TextEncoder().encode(params.message),
    params.signature,
    {
      address: walletAddress,
      ...(params.client ? { client: params.client } : {}),
    },
  );
}
