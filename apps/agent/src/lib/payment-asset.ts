import { env } from '../config/env';

const OFFICIAL_USDC_TYPES = {
  mainnet: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
  testnet: '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC',
} as const;

export const paymentAsset = {
  type: env.SUI_PAYMENT_COIN_TYPE,
  symbol: env.SUI_PAYMENT_COIN_SYMBOL,
  decimals: env.SUI_PAYMENT_COIN_DECIMALS,
  network: env.SUI_NETWORK,
  issuer: 'Circle',
  faucetUrl: env.SUI_NETWORK === 'testnet' ? 'https://faucet.circle.com/' : null,
} as const;

export function parseHumanAmount(input: string, decimals = paymentAsset.decimals): bigint {
  const normalized = input.trim();
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid ${paymentAsset.symbol} amount`);
  }
  const [whole = '0', fraction = ''] = normalized.split('.');
  if (fraction.length > decimals) {
    throw new Error(`${paymentAsset.symbol} supports at most ${decimals} decimal places`);
  }
  const base = 10n ** BigInt(decimals);
  const value = (BigInt(whole) * base) + BigInt(fraction.padEnd(decimals, '0') || '0');
  if (value <= 0n) throw new Error('Amount must be greater than zero');
  return value;
}

export function formatHumanAmount(value: bigint, decimals = paymentAsset.decimals): string {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = (value % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export async function assertPaymentAssetConfiguration(
  getCoinMetadata: (coinType: string) => Promise<{ symbol?: string | null; decimals?: number | null } | null>,
) {
  if (env.EXTERNAL_SERVICES_MODE !== 'live') return;
  if (paymentAsset.type === '0x2::sui::SUI') {
    throw new Error('[ENV] BondFlow v2 requires a verified USDC coin type; native SUI is not accepted as USDC.');
  }
  if (paymentAsset.symbol === 'USDC' && (env.SUI_NETWORK === 'mainnet' || env.SUI_NETWORK === 'testnet')) {
    const expectedType = OFFICIAL_USDC_TYPES[env.SUI_NETWORK];
    if (paymentAsset.type !== expectedType) {
      throw new Error(
        `[ENV] Unverified ${env.SUI_NETWORK} USDC type. Expected Circle USDC ${expectedType}, `
        + `received ${paymentAsset.type}.`,
      );
    }
  }
  const metadata = await getCoinMetadata(paymentAsset.type);
  if (!metadata) throw new Error(`[ENV] No coin metadata found for ${paymentAsset.type}`);
  if (metadata.symbol !== paymentAsset.symbol || metadata.decimals !== paymentAsset.decimals) {
    throw new Error(
      `[ENV] Payment asset metadata mismatch. Expected ${paymentAsset.symbol}/${paymentAsset.decimals}, `
      + `received ${metadata.symbol ?? 'unknown'}/${metadata.decimals ?? 'unknown'}.`,
    );
  }
}
