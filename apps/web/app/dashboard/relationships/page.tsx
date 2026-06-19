import type { Metadata } from 'next';
import { AssignedRelationshipsClient } from '@/components/relationships/assigned-relationships-client';

export const metadata: Metadata = {
  title: 'Assigned Relationships',
  description: 'Payment relationships assigned to your wallet.',
};

export default function PersonalRelationshipsPage() {
  return <AssignedRelationshipsClient />;
}
