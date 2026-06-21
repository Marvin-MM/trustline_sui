import { describe, expect, it } from 'vitest';
import { getApiErrorMessage } from '@/lib/api-error';

describe('getApiErrorMessage', () => {
  it('shows required and available USDC for relationship funding errors', () => {
    const error = {
      isAxiosError: true,
      message: 'Request failed with status code 422',
      response: {
        data: {
          error: 'This wallet does not have enough USDC to fund the relationship.',
          code: 'INSUFFICIENT_PAYMENT_BALANCE',
          details: {
            asset: { symbol: 'USDC', decimals: 6 },
            requiredPaymentBaseUnits: '500000000',
            balanceBaseUnits: '20000000',
          },
        },
      },
    };

    expect(getApiErrorMessage(error)).toBe(
      'This wallet does not have enough USDC to fund the relationship. Required: 500 USDC. Available: 20 USDC.',
    );
  });

  it('formats Axios timeout milliseconds as human-readable seconds', () => {
    const error = {
      isAxiosError: true,
      code: 'ECONNABORTED',
      message: 'timeout of 120000ms exceeded',
      config: { timeout: 120_000 },
    };

    expect(getApiErrorMessage(error)).toBe(
      'The request took longer than 120 seconds. Processing may still complete in the background.',
    );
  });
});
