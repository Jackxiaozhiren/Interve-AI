import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - pdf.worker.min.mjs (public worker)
     */
    '/((?!_next/static|_next/image|favicon.ico|pdf\\.worker\\.min\\.mjs).*)',
  ],
};

export default function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // 1. Dashboard Protection
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/dashboard')) {
    const userCookie = request.cookies.get('interveai_user');
    
    if (!userCookie || !userCookie.value) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    try {
      const user = JSON.parse(userCookie.value);
      if (!user || typeof user !== 'object' || !user.id) {
        throw new Error('Invalid user format');
      }
    } catch {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', request.nextUrl.pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('interveai_user');
      return response;
    }
  }

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
