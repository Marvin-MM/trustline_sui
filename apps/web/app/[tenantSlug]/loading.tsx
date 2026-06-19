import { StatsCardSkeleton, RelationshipCardSkeleton } from '@/components/ui/skeletons';

export default function TenantLoading() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <StatsCardSkeleton key={i} />)}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <RelationshipCardSkeleton key={i} />)}
      </div>
    </div>
  );
}
