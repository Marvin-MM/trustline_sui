/**
 * Sui client singleton.
 *
 * @mysten/sui v2 renamed the client API:
 *   - Old: SuiClient + getFullnodeUrl from '@mysten/sui/client'
 *   - New: SuiJsonRpcClient + getJsonRpcFullnodeUrl from '@mysten/sui/jsonRpc'
 *
 * The frontend uses this client for direct RPC calls (health checks, tx polling).
 * Most on-chain writes go through the backend PTB flow, not this client directly.
 *
 * NOTE: SuiJsonRpcClientOptions requires BOTH `url` and `network`.
 */

import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';

type SuiNetwork = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

const SUI_NETWORK_ENV = (process.env['NEXT_PUBLIC_SUI_NETWORK'] ?? 'testnet') as SuiNetwork;

const rpcUrl =
  process.env['NEXT_PUBLIC_SUI_RPC_URL'] ?? getJsonRpcFullnodeUrl(SUI_NETWORK_ENV);

export const suiClient = new SuiJsonRpcClient({
  url: rpcUrl,
  network: SUI_NETWORK_ENV,
});

export const SUI_NETWORK = SUI_NETWORK_ENV;
export const SUI_EXPLORER_URL =
  process.env['NEXT_PUBLIC_SUI_EXPLORER_URL'] ?? 'https://testnet.suivision.xyz';
