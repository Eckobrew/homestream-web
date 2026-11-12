import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/tv-api';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const username = (formData.get('username') as string) || '';
    const password = (formData.get('password') as string) || '';

    if (!username.trim()) {
      return NextResponse.redirect(new URL('/tv/login?error=Username%20is%20required', request.url), 303);
    }

    const res = await fetch(`${getBackendUrl()}/api/v1/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username.trim(),
        password: password || '',
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      const errMsg = encodeURIComponent(data.error || 'Invalid username or password');
      return NextResponse.redirect(new URL(`/tv/login?error=${errMsg}`, request.url), 303);
    }

    const redirectUrl = new URL('/tv', request.url);
    const response = NextResponse.redirect(redirectUrl, 303);

    const setCookieHeader = res.headers.get('set-cookie');
    if (setCookieHeader) {
      const matchSession = /homeflix_session=([^;]+)/.exec(setCookieHeader);
      if (matchSession) {
        response.cookies.set('homeflix_session', matchSession[1], {
          path: '/',
          maxAge: 31536000,
          sameSite: 'lax',
          httpOnly: false,
        });
      }
      const matchProfile = /homeflix_profile_id=([^;]+)/.exec(setCookieHeader);
      if (matchProfile) {
        response.cookies.set('homeflix_profile_id', matchProfile[1], {
          path: '/',
          maxAge: 31536000,
          sameSite: 'lax',
          httpOnly: false,
        });
      }
    }

    return response;
  } catch (err: any) {
    return NextResponse.redirect(new URL('/tv/login?error=Server%20connection%20failed', request.url), 303);
  }
}
