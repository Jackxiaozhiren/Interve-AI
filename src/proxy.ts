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
  
  /*
   * Content Security Policy — one header, enforced.
   *
   * `cdn.jsdelivr.net` in script-src is NOT dead: `@monaco-editor/loader`
   * defaults to `vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs'`
   * and the scratchpad never calls `loader.config()`, so the code editor's
   * script comes from that origin at runtime. Grepping `src/` for the hostname
   * finds nothing and proves nothing — the first cut of this change removed it
   * and would have broken the editor in production. It stays until Monaco is
   * bundled locally (`loader.config({ monaco })`), which is the only change
   * that lets this origin go and also makes the privacy page's disclosure
   * about it removable.
   *
   * `http:` is gone from img-src for the opposite reason: zero `src="http:`
   * literals anywhere, and leaving it open permits a mixed-content image
   * downgrade. The two Google Fonts origins are gone for the same class of
   * reason, verified the way jsDelivr should have been: no `next/font` import,
   * no `<link>` in any layout, no `@import url(...)` in globals.css and no
   * bundled woff file, so the browser never sends a request to either origin —
   * `--font-inter` falls back to the local/system stack.
   *
   * `'unsafe-inline'` stays, for two measured reasons rather than a shrug:
   * - 57 `style={{}}` attributes across 34 files (AST count, re-derived by
   *   tests/unit/csp-scope.test.ts, which fails if that number reaches 0 while
   *   this header still allows it — that is the real convergence signal);
   * - Next.js injects its own inline bootstrap scripts, so `script-src 'self'`
   *   is unsatisfiable without per-response nonces, which this deployment
   *   (Vercel + a middleware-set header, no custom server) cannot mint per request.
   *
   * The strict `Content-Security-Policy-Report-Only` header that used to sit
   * here is deleted, not deferred. Measured against a production build it
   * produced 9-12 console violations on every route (/ 9, /login 11, /signup 12,
   * /landing 9), including one for the framework's own inline script, so its
   * target state was unreachable on both axes while its reports went to an
   * endpoint that only logs to stdout and nobody queried. A permanent error
   * stream that blocks nothing is not a migration plan — it is noise that hides
   * the violations that would matter. /api/csp-report stays, so re-adding a
   * report-only policy costs one header, and csp-scope.test.ts pins why there is
   * currently no second one.
   */
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net;
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https:;
    font-src 'self';
    connect-src * blob: data:;
    worker-src 'self' blob:;
    frame-src 'self';
    object-src 'none';
    base-uri 'self';
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
