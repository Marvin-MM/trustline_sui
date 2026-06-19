import { DeliverableUploadPageClient } from './upload-client';

export const metadata = { title: 'Deliverable Upload' };

export default async function DeliverableUploadPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = await params;
  return <DeliverableUploadPageClient tenantSlug={tenantSlug} relationshipId={id} />;
}
