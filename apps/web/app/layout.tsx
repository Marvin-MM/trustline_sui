import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/layout/providers';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#030712' },
  ],
};

export const metadata: Metadata = {
  title: {
    default: 'TrustLine — Programmable Payment Relationships on Sui',
    template: '%s | TrustLine',
  },
  description:
    'TrustLine is a programmable payment relationship protocol on Sui. Create milestone-based payment relationships with AI verification, encrypted memory, and verifiable reputation.',
  keywords: ['Sui', 'blockchain', 'payments', 'escrow', 'smart contracts', 'DeFi', 'TrustLine'],
  authors: [{ name: 'TrustLine' }],
  metadataBase: new URL(process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'TrustLine — Programmable Payment Relationships on Sui',
    description: 'Payments are relationships, not transfers.',
    siteName: 'TrustLine',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TrustLine',
    description: 'Programmable payment relationships on Sui.',
  },
  robots: { index: true, follow: true },
  icons: {
    icon: '/logos/favico.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <body className="font-sans antialiased min-h-screen bg-background">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
