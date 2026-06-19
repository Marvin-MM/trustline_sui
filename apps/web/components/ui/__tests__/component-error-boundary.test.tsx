import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentErrorBoundary } from '../component-error-boundary';

function BrokenComponent(): React.ReactElement {
  throw new Error('boom');
}

describe('ComponentErrorBoundary', () => {
  it('renders fallback and can reset', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <ComponentErrorBoundary>
        <BrokenComponent />
      </ComponentErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    consoleSpy.mockRestore();
  });
});
