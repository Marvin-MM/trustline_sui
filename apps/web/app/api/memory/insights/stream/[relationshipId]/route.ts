import { NextRequest } from 'next/server';
import { streamText, type CoreMessage } from 'ai';
import { createGroq } from '@ai-sdk/groq';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const GROQ_MODEL = 'llama-3.3-70b-versatile';

/**
 * Per-process sliding-window limiter. Deliberately not Redis-backed: this route calls a
 * paid LLM API directly from the edge of the app, so it needs *some* abuse guard, but the
 * traffic this page sees doesn't justify a shared store yet. If this is ever deployed across
 * multiple Next.js instances, swap this for a shared limiter (e.g. Upstash) instead of relying
 * on each instance's own memory.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 12;
const requestLog = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX) {
    requestLog.set(key, timestamps);
    return true;
  }
  timestamps.push(now);
  requestLog.set(key, timestamps);
  return false;
}

interface MemoryEntry {
  summary: string;
  keyInsights: string[];
  riskFactors: string[];
  relationshipHealth: string;
  recommendedActions: string[];
  eventType: string;
  createdAt: string;
}

interface RelationshipSummary {
  status: string;
  memo: string;
  totalAmount: string;
  releasedAmount: string;
  milestones: Array<{ index: number; status: string; conditionType: string }>;
}

/**
 * POST /api/memory/insights/stream/[relationshipId]
 *
 * Client + Next.js route-handler implementation, intentionally kept off the agent backend:
 * this is a throwaway, unpersisted Q&A surface over data the backend already exposes
 * (memory entries + relationship summary), so it doesn't need the backend's AI pipeline,
 * cost/audit tracking, or Redis-backed plumbing — those exist for durable agent actions,
 * not ephemeral UI chat. Streams real token-by-token output from Groq via the Vercel AI SDK.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ relationshipId: string }> }
) {
  const { relationshipId } = await params;
  const authorization = request.headers.get('authorization');
  const tenantId = request.headers.get('x-tenant-id');

  if (!authorization) {
    return new Response('Authentication required', { status: 401 });
  }
  if (isRateLimited(`${authorization}:${relationshipId}`)) {
    return new Response('Too many questions — please wait a moment before asking again.', { status: 429 });
  }

  const groqApiKey = process.env['GROQ_API_KEY'];
  if (!groqApiKey) {
    return new Response('AI insights are not configured on this deployment.', { status: 503 });
  }

  const { messages } = await request.json() as { messages: CoreMessage[] };
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000';
  const backendHeaders = {
    Authorization: authorization,
    ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
  };

  // Pull this relationship's memory + summary straight from the existing, unmodified
  // backend endpoints — no new backend surface, no AI call on that side.
  const [relationshipRes, memoryRes] = await Promise.all([
    fetch(`${apiUrl}/api/v1/relationships/${relationshipId}`, { headers: backendHeaders, cache: 'no-store' }),
    fetch(`${apiUrl}/api/v1/memory/${relationshipId}?page=1&limit=50`, { headers: backendHeaders, cache: 'no-store' }),
  ]);

  if (relationshipRes.status === 401 || memoryRes.status === 401) {
    return new Response('Authentication required', { status: 401 });
  }
  if (relationshipRes.status === 404 || memoryRes.status === 404) {
    return new Response('Relationship not found', { status: 404 });
  }
  if (!relationshipRes.ok || !memoryRes.ok) {
    return new Response('Unable to load relationship memory', { status: 502 });
  }

  const relationship = await relationshipRes.json() as RelationshipSummary;
  const memoryPayload = await memoryRes.json() as { data?: MemoryEntry[] } | MemoryEntry[];
  const entries = Array.isArray(memoryPayload) ? memoryPayload : memoryPayload.data ?? [];

  const memoryContext = entries.length > 0
    ? entries
        .map((e) => `[${e.createdAt}] (${e.relationshipHealth}) ${e.summary}${e.riskFactors.length ? ` | Risks: ${e.riskFactors.join(', ')}` : ''}`)
        .join('\n')
    : 'No memory entries have been recorded for this relationship yet.';

  const relationshipContext = JSON.stringify({
    status: relationship.status,
    memo: relationship.memo,
    totalAmount: relationship.totalAmount,
    releasedAmount: relationship.releasedAmount,
    milestones: relationship.milestones?.map((m) => ({ index: m.index, status: m.status, conditionType: m.conditionType })),
  });

  const systemPrompt = `You are a memory insight assistant embedded in the detail page for one specific payment relationship on BondFlow.

Answer strictly using the relationship data and memory entries below — this is the only relationship the user can be asking about. Do not give generic advice that isn't grounded in this data. If the memory entries don't contain enough information to answer, say so plainly instead of guessing.

Relationship summary:
${relationshipContext}

Memory entries (most recent activity, newest first):
${memoryContext}

Keep answers concise and reference specific entries or milestones where relevant. The conversation may include earlier turns from this same session — use them for continuity, but always ground new answers in the data above.`;

  const groq = createGroq({ apiKey: groqApiKey });

  const result = streamText({
    model: groq(GROQ_MODEL),
    system: systemPrompt,
    messages,
  });

  return result.toDataStreamResponse();
}
