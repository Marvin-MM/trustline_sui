import { NextResponse } from 'next/server';

/**
 * GET /api/health
 *
 * Simple health endpoint for the frontend container.
 * Used by the load balancer / k8s readiness probe.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'bondflow-web',
    timestamp: new Date().toISOString(),
    version: process.env['npm_package_version'] ?? '0.1.0',
  });
}
