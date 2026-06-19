import { env } from '../config/env';

function normalizeWalletAddress(address: string | null | undefined): string {
  return address?.trim().toLowerCase() ?? '';
}

/**
 * Platform administration is intentionally single-wallet for this deployment.
 * The database flag is kept for indexing/audit convenience, but effective admin
 * authority is derived from ADMIN_WALLET_ADDRESS on every auth path.
 */
export function isConfiguredPlatformAdmin(walletAddress: string | null | undefined): boolean {
  const configuredAdmin = normalizeWalletAddress(env.ADMIN_WALLET_ADDRESS);
  if (!configuredAdmin) return false;
  return normalizeWalletAddress(walletAddress) === configuredAdmin;
}
