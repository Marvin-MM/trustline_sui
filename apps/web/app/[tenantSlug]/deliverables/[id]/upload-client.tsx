'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileUp } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { UploadZone } from '@/components/deliverables/upload-zone';
import { AIInsightBadge } from '@/components/agents/ai-insight-badge';
import { queryKeys } from '@/lib/query-keys';
import { relationshipsApi } from '@/lib/api/relationships';
import { ROUTES } from '@/constants/routes';
import type { UploadDeliverableResponse } from '@/lib/api/deliverables';

export function DeliverableUploadPageClient({
  tenantSlug,
  relationshipId,
}: {
  tenantSlug: string;
  relationshipId: string;
}) {
  const [upload, setUpload] = useState<UploadDeliverableResponse | null>(null);

  const { data: relationship } = useQuery({
    queryKey: queryKeys.relationships.detail(relationshipId),
    queryFn: () => relationshipsApi.getById(relationshipId),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upload Deliverable"
        description={relationship?.memo ?? 'Attach proof of milestone completion'}
        icon={FileUp}
        breadcrumbs={[
          { label: 'Relationships', href: ROUTES.tenantRelationships(tenantSlug) },
          { label: relationship?.memo ?? relationshipId, href: ROUTES.tenantRelationshipDetail(tenantSlug, relationshipId) },
          { label: 'Deliverable' },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <UploadZone
          relationshipId={relationshipId}
          milestoneIndex={0}
          onSuccess={setUpload}
        />

        <aside className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Verification</h2>
          {upload ? (
            <div className="mt-4 space-y-3">
              <AIInsightBadge
                actionType="CONTENT_SCANNED"
                decision="PENDING"
                confidence={null}
                reasoningText="Upload recorded. AI verification will appear here once the backend job completes."
              />
              <p className="font-mono-num text-xs text-muted-foreground break-all">{upload.blobId}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Upload a deliverable to start content scanning and milestone verification.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
