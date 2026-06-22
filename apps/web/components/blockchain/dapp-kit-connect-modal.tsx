'use client';

import { useEffect, useRef } from 'react';
import { ConnectModal } from '@mysten/dapp-kit-react/ui';
import type { DAppKitConnectModal as DAppKitConnectModalElement } from '@mysten/dapp-kit-core/web';
import { useTheme } from 'next-themes';

interface DAppKitConnectModalProps {
  open: boolean;
  onClosed: () => void;
}

/**
 * DAppKitConnectModal — wraps the Lit web component provided by @mysten/dapp-kit-react/ui.
 *
 * The ConnectModal is a Lit-based web component that renders inside its own shadow DOM,
 * so it cannot inherit styles from the host document. It exposes a set of CSS custom
 * properties (--background, --foreground, --primary, etc.) on its host element that must
 * be set explicitly. We read the resolved values from our theme via getComputedStyle and
 * forward them to the web component's host element, so the modal matches our design
 * system in both light and dark modes.
 */
export function DAppKitConnectModal({ open, onClosed }: DAppKitConnectModalProps) {
  const ref = useRef<DAppKitConnectModalElement | null>(null);
  const { resolvedTheme } = useTheme();

  // Apply CSS custom properties to the web component host element so it picks
  // up our design tokens instead of rendering transparent/unstyled.
  useEffect(() => {
    const modal = ref.current;
    if (!modal) return;

    // Read CSS variables from the document root — these are our Tailwind theme tokens
    // in "H S% L%" format. We wrap them with hsl() so the web component can consume them.
    const root = document.documentElement;
    const style = getComputedStyle(root);

    const get = (name: string): string => {
      const raw = style.getPropertyValue(name).trim();
      // If already a full color value (starts with #, rgb, hsl, etc.) return as-is
      if (!raw || raw.startsWith('#') || raw.startsWith('rgb') || raw.startsWith('hsl')) {
        return raw;
      }
      // Our Tailwind vars are stored as bare "H S% L%" — wrap with hsl()
      return `hsl(${raw})`;
    };

    const vars: Record<string, string> = {
      '--background': get('--background'),
      '--foreground': get('--foreground'),
      '--primary': get('--primary'),
      '--primary-foreground': get('--primary-foreground'),
      '--secondary': get('--secondary'),
      '--secondary-foreground': get('--secondary-foreground'),
      '--border': get('--border'),
      '--accent': get('--accent'),
      '--accent-foreground': get('--accent-foreground'),
      '--muted': get('--muted'),
      '--muted-foreground': get('--muted-foreground'),
      '--popover': get('--popover'),
      '--popover-foreground': get('--popover-foreground'),
    };

    // Fallback: if the popover var is missing, use background
    if (!vars['--popover'] || vars['--popover'] === 'hsl()') {
      vars['--popover'] = vars['--background'] ?? '';
      vars['--popover-foreground'] = vars['--foreground'] ?? '';
    }

    Object.entries(vars).forEach(([key, value]) => {
      if (value) {
        modal.style.setProperty(key, value);
      }
    });
  }, [resolvedTheme, open]); // re-apply when theme changes or modal opens

  // Wire up the 'closed' event
  useEffect(() => {
    const modal = ref.current;
    if (!modal) return;
    modal.addEventListener('closed', onClosed);
    return () => modal.removeEventListener('closed', onClosed);
  }, [onClosed]);

  return <ConnectModal ref={ref} open={open} />;
}
