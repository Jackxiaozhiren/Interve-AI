import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, getSessionSecret, verifySessionCookie } from '@/lib/api/session';

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

// Phase 2: every page that consumes metered AI APIs requires a signed
// session. Anonymous demo browsing (/, /landing, /login, /signup) stays open.
// /api/* enforcement lives in each Route Handler (guardRequest), not here.
const PROTECTED_PAGE_PREFIXES = [
  '/dashboard',
  '/setup',
  '/interview',
  '/chat',
  '/recruiter',
  '/practice',
];

function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PAGE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function loginRedirect(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('from', request.nextUrl.pathname);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // 1. Session protection (HMAC-signed cookie; legacy unsigned cookies fail
  //    verification and force one re-login).
  if (isProtectedPage(pathname) || pathname.startsWith('/api/dashboard')) {
    const raw = request.cookies.get(SESSION_COOKIE)?.value;
    const secret = getSessionSecret();
    // Fail closed when the server cannot verify sessions at all.
    if (!secret || !raw) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      return loginRedirect(request);
    }
    return verifySessionCookie(raw, secret).then((session) => {
      if (!session || !session.id) {
        if (pathname.startsWith('/api/')) {
          return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
        return loginRedirect(request);
      }
      return afterAuth(request, pathname, searchParams);
    });
  }

  return afterAuth(request, pathname, searchParams);
}

function afterAuth(request: NextRequest, pathname: string, searchParams: URLSearchParams) {

  // 2. Interview preflight check
  if (pathname.startsWith('/interview')) {
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.redirect(new URL('/setup', request.url));
    }
  }

  // 3. HTTP Security Headers
  const response = NextResponse.next();
  
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https: http:;
    font-src 'self' https://fonts.gstatic.com;
    connect-src * blob: data:;
    worker-src 'self' blob:;
    frame-src 'self';
    media-src 'self' blob: data:;
  `.replace(/\s{2,}/g, ' ').trim();

  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
  response.headers.set('X-DNS-Prefetch-Control', 'on');

  return response;
}
