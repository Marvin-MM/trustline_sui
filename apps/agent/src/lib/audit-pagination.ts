export interface TimestampedAuditEntry {
  id: string;
  timestamp: Date | string;
}

export function auditFetchDepth(page: number, limit: number): number {
  return page * limit;
}

export function paginateAuditEntries<T extends TimestampedAuditEntry>(
  entries: T[],
  page: number,
  limit: number,
): T[] {
  return entries
    .sort((left, right) => {
      const timeDifference = new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
      return timeDifference !== 0 ? timeDifference : right.id.localeCompare(left.id);
    })
    .slice((page - 1) * limit, page * limit);
}
