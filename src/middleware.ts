import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const proto = request.headers.get('x-forwarded-proto');
  const host = request.headers.get('host') || request.nextUrl.host;
  const hostname = host.split(':')[0];
  const isLocalHost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(hostname);

  if (process.env.HOMESTREAM_FORCE_HTTPS === 'true' && proto === 'http' && !isLocalHost) {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = 'https:';
    httpsUrl.host = hostname;
    httpsUrl.port = '';
    return NextResponse.redirect(httpsUrl, 308);
  }

  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  // Only check root homepage for Smart TV redirect
  if (pathname === '/') {
    const override = request.nextUrl.searchParams.get('mode');
    if (override === 'desktop') {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    const ua = request.headers.get('user-agent') || '';
    const isSmartTv = /SmartTV|Tizen [1234]|Maple2012|Maple|Web0S|HbbTV|NetCast|Viera|BRAVIA/i.test(ua);

    if (isSmartTv) {
      const url = request.nextUrl.clone();
      url.pathname = '/tv';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
