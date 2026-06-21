import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PtbPreviewModal } from '../ptb-preview-modal';
import { UITransactionStatus } from '@/lib/transaction-status';

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  description: 'Create payment relationship',
  estimatedGas: '1000000',
  ptbBytes: 'abcd1234',
  errorMessage: null,
  digest: null,
  onConfirm: vi.fn(),
  onClose: vi.fn(),
};

describe('PtbPreviewModal', () => {
  it('enables signing only after review is ready', async () => {
    const onConfirm = vi.fn();

    render(
      <PtbPreviewModal
        {...baseProps}
        status={UITransactionStatus.AWAITING_SIGNATURE}
        onConfirm={onConfirm}
      />,
    );

    const button = screen.getByRole('button', { name: 'Sign & Submit' });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('blocks signing when dry run fails', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <PtbPreviewModal
        {...baseProps}
        status={UITransactionStatus.DRY_RUN_FAILED}
        errorMessage="MoveAbort location=0x1::payment code=42"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    const button = screen.getAllByRole('button', { name: 'Close' })
      .find((candidate) => candidate.textContent === 'Close');
    expect(button).toBeDefined();
    expect(button).toBeEnabled();
    await userEvent.click(button!);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('keeps Done unavailable while confirmed lifecycle work is finalizing', () => {
    render(
      <PtbPreviewModal
        {...baseProps}
        status={UITransactionStatus.FINALIZING}
      />,
    );

    expect(screen.getByRole('button', { name: 'Finalizing...' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it('blocks signing and offers reconnection without a live wallet', async () => {
    const onConfirm = vi.fn();
    const onConnectWallet = vi.fn();

    render(
      <PtbPreviewModal
        {...baseProps}
        status={UITransactionStatus.AWAITING_SIGNATURE}
        walletConnected={false}
        walletWarning="No wallet is connected for signing."
        onConnectWallet={onConnectWallet}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText('No wallet is connected for signing.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign & Submit' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Reconnect Wallet' }));
    expect(onConnectWallet).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
