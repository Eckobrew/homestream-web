import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

async function proxyToBackend(request: NextRequest, pathSegments: string[]) {
  const backend = (process.env.HOMESTREAM_BACKEND_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '');
  const target = new URL(`${backend}/rest/${pathSegments.map(encodeURIComponent).join('/')}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  for (const [k, v] of request.headers.entries()) {
    if (k.toLowerCase() === 'host') continue;
    headers.set(k, v);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    signal: request.signal,
  };
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(target.toString(), init);
  return new Response(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToBackend(request, (await context.params).path);
}

export async function HEAD(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToBackend(request, (await context.params).path);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToBackend(request, (await context.params).path);
}

export async function OPTIONS(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyToBackend(request, (await context.params).path);
}
