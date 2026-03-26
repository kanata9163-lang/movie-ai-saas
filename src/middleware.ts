import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Pre-compiled set for O(1) lookup
const PUBLIC_PREFIXES = ['/login', '/signup', '/auth/callback', '/api/auth/login', '/api/auth/signup', '/api/auth/callback', '/api/auth/oauth-complete'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths that don't require auth
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // API routes under /api/w/ and /api/me/ - require auth token
  if (pathname.startsWith('/api/w/') || pathname.startsWith('/api/me/')) {
    const accessToken = request.cookies.get('sb-access-token')?.value;
    if (!accessToken) {
      return NextResponse.json(
        { ok: false, data: null, error: { code: 'unauthorized', message: 'Not logged in' } },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // Other API routes (e.g. /api/auth/*) pass through
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Check for auth cookie on workspace pages
  if (pathname.startsWith('/w/')) {
    const accessToken = request.cookies.get('sb-access-token')?.value;
    if (!accessToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts).*)'],
};
