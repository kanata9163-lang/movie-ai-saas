import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths that don't require auth
  const publicPaths = ['/login', '/signup', '/api/auth/login', '/api/auth/signup'];
  if (publicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // API routes - check for auth cookie
  if (pathname.startsWith('/api/')) {
    return NextResponse.next(); // API routes handle their own auth via service_role
  }

  // Check for auth cookie on workspace pages
  if (pathname.startsWith('/w/')) {
    const userId = request.cookies.get('sb-user-id')?.value;
    if (!userId) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts).*)'],
};
