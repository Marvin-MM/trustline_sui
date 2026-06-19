'use client';

import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';

type SuiNetwork = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

const SUI_NETWORK_ENV = (process.env['NEXT_PUBLIC_SUI_NETWORK'] ?? 'testnet') as SuiNetwork;
const rpcUrl = process.env['NEXT_PUBLIC_SUI_RPC_URL'] ?? getJsonRpcFullnodeUrl(SUI_NETWORK_ENV);
const enableBurnerWallet = process.env['NEXT_PUBLIC_ENABLE_BURNER_WALLET'] === 'true';
const enableSlushWebWallet = process.env['NEXT_PUBLIC_ENABLE_SLUSH_WEB_WALLET'] === 'true';

export const dAppKit = createDAppKit({
  // Restore the most recently authorized wallet after navigation or refresh.
  // Backend authentication is persisted separately and is not a signing connection.
  autoConnect: true,
  networks: [SUI_NETWORK_ENV],
  defaultNetwork: SUI_NETWORK_ENV,
  createClient: () => new SuiJsonRpcClient({ url: rpcUrl, network: SUI_NETWORK_ENV }),
  slushWalletConfig: enableSlushWebWallet ? { appName: 'BondFlow' } : null,
  enableBurnerWallet,
});

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
