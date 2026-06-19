import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { ConfirmDialog } from '../confirm-dialog';

describe('ConfirmDialog', () => {
  it('renders accessibly and calls confirm', async () => {
    const onConfirm = vi.fn();
    const { container } = render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Cancel Relationship"
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={onConfirm}
        variant="destructive"
      />,
    );

    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
