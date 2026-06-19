/**
 * React Query client factory.
 *
 * Two modes:
 * 1. Server Components: getQueryClient() returns a per-request singleton
 *    (cached via React's cache()) for prefetch + HydrationBoundary.
 * 2. Client Components: makeQueryClient() creates a fresh instance once
 *    per browser session.
 *
 * This follows the TanStack advanced SSR guide exactly.
 */

import {
  QueryClient,
  defaultShouldDehydrateQuery,
  isServer,
} from '@tanstack/react-query';
import { cache } from 'react';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Prevent refetch on window focus in production for financial data
        refetchOnWindowFocus: false,
        // With SSR, set staleTime above 0 to avoid immediate refetch on client
        staleTime: 60 * 1000, // 1 minute
        retry: 2,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      },
      dehydrate: {
        // Include pending queries in dehydrated state so Suspense can stream them
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === 'pending',
      },
    },
  });
}

// Browser-side singleton (created once per browser session)
let browserQueryClient: QueryClient | undefined;

function getBrowserQueryClient(): QueryClient {
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

// Server-side singleton (cached per request via React's cache())
export const getQueryClient = cache(() => makeQueryClient());

/**
 * Returns the appropriate query client:
 * - Server: a fresh instance per request (via React cache)
 * - Client: the browser singleton
 */
export function getOrCreateQueryClient(): QueryClient {
  if (isServer) {
    return getQueryClient();
  }
  return getBrowserQueryClient();
}
