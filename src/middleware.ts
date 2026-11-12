import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
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
  matcher: ['/', '/tv/:path*'],
};
