export interface RateLimitHeaderResult {
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter: number | null;
}

export function setRateLimitHeaders(
  headers: Record<string, string>,
  result: RateLimitHeaderResult,
): void {
  headers['X-RateLimit-Limit'] = String(result.limit);
  headers['X-RateLimit-Remaining'] = String(result.remaining);
  headers['X-RateLimit-Reset'] = String(result.resetAt);

  if (result.retryAfter !== null) {
    headers['Retry-After'] = String(result.retryAfter);
  }
}
