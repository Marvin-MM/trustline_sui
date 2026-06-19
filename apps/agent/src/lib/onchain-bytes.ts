export function bytes32FromExternalId(input: string): number[] {
  const normalized = input.startsWith('0x') ? input.slice(2) : input;
  if (/^[0-9a-fA-F]{64}$/.test(normalized)) {
    return Array.from(Buffer.from(normalized, 'hex'));
  }
  if (/^[A-Za-z0-9_-]{43,44}$/.test(normalized)) {
    const decoded = Buffer.from(normalized, 'base64url');
    if (decoded.length === 32) return Array.from(decoded);
  }
  throw new Error('Expected a 32-byte hex hash or Walrus base64url blob ID');
}
