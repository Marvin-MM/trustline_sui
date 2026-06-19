const DEFAULT_WALRUS_AGGREGATOR_URL = 'https://aggregator.walrus-testnet.walrus.space';

export function buildWalrusBlobUrl(blobId: string): string {
  const baseUrl = process.env['NEXT_PUBLIC_WALRUS_AGGREGATOR_URL'] ?? DEFAULT_WALRUS_AGGREGATOR_URL;
  return `${baseUrl.replace(/\/$/, '')}/v1/blobs/${encodeURIComponent(blobId)}`;
}
