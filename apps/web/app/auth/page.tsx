import type { Metadata } from 'next';
import { AuthPageClient } from './auth-client';

export const metadata: Metadata = {
  title: 'Connect Wallet',
  description: 'Connect your Sui wallet to access BondFlow.',
};

export default function AuthPage() {
  return <AuthPageClient />;
}
