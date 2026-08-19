import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const auth = req.headers.get('authorization') || '';

  const backendUrl = process.env.FASTAPI_BASE_URL || 'http://127.0.0.1:8000';

  const upstream = await fetch(`${backendUrl}/v1/canvas/prompt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { 'Authorization': auth } : {}),
    },
    body,
    cache: 'no-store',
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
