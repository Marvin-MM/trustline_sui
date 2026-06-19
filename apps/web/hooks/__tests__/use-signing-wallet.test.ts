import { describe, expect, it } from 'vitest';
import { getSigningWalletWarning } from '../use-signing-wallet';

describe('getSigningWalletWarning', () => {
  const authenticated = `0x${'a'.repeat(64)}`;

  it('requires a live wallet connection even when the session is restored', () => {
    expect(getSigningWalletWarning(authenticated, null)).toContain(
      'no wallet is connected for signing',
    );
  });

  it('rejects a connected wallet that differs from the authenticated wallet', () => {
    expect(getSigningWalletWarning(authenticated, `0x${'b'.repeat(64)}`)).toContain(
      'does not match',
    );
  });

  it('accepts the authenticated wallet case-insensitively', () => {
    expect(getSigningWalletWarning(authenticated.toUpperCase(), authenticated)).toBeNull();
  });
});
