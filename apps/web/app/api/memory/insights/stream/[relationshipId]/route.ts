import { NextRequest } from 'next/server';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

/**
 * POST /api/memory/insights/stream/[relationshipId]
 *
 * Streams AI insights about the relationship's memory to the client.
 * This is the server-side route that useChat() in MemoryInsightPanel hits.
 *
 * Proxies to the backend MemoryInsightAgent. The backend owns Gemini keys,
 * tenant scoping, rate limiting, and relationship authorization.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ relationshipId: string }> }
) {
  const { relationshipId } = await params;
  const { messages } = await request.json() as { messages: Array<{ role: string; content: string }> };
  const question = [...messages].reverse().find((m) => m.role === 'user')?.content ?? 'What is the overall health of this relationship?';
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000';
  const authorization = request.headers.get('authorization');
  const tenantId = request.headers.get('x-tenant-id');

  if (!authorization) {
    return new Response('Authentication required', { status: 401 });
  }

  const backendResponse = await fetch(
    `${apiUrl}/api/v1/memory/${relationshipId}/insights?question=${encodeURIComponent(question)}`,
    {
      headers: {
        Authorization: authorization,
        ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
      },
      cache: 'no-store',
    },
  );

  if (!backendResponse.ok) {
    return new Response('Unable to generate memory insight', { status: backendResponse.status });
  }

  const insight = await backendResponse.json() as {
    insight?: string;
    confidence?: number;
    relevantEntries?: string[];
    suggestedFollowUp?: string;
  };

  const text = [
    insight.insight ?? 'No insight was returned.',
    typeof insight.confidence === 'number' ? `\n\nConfidence: ${insight.confidence}%` : '',
    insight.suggestedFollowUp ? `\n\nSuggested follow-up: ${insight.suggestedFollowUp}` : '',
  ].join('');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const words = text.split(/(\s+)/);
      let index = 0;
      const push = () => {
        if (index >= words.length) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(words[index]));
        index += 1;
        setTimeout(push, 12);
      };
      push();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
